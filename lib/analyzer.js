import { searchCompound } from './pubchem.js';
import { findFallback } from './fallbackData.js';
import { enrichStoichiometry } from './stoichiometry.js';
import {
  DEFAULT_PRIMARY_PROMPT,
  DEFAULT_RETRY_PROMPT,
  extractComponentsFromLLM,
  retryCompoundName
} from './llm.js';

function dedupe(list) {
  return Array.from(new Set(list.filter(Boolean).map((n) => n.trim())));
}

const COMPONENT_CONCURRENCY =
  Number.parseInt(process.env.PUBCHEM_COMPONENT_CONCURRENCY || '', 10) || 2;

async function enrichWithChemData(
  component,
  logs,
  candidateNames,
  retryPrompt,
  input,
  retryFn = retryCompoundName,
  onResolved,
  debug
) {
  const names = dedupe([component.name, ...candidateNames]);
  logs(`Anreicherung für Komponente "${component.originalName || component.name}" gestartet.`);
  let attempt = 1;
  const attempts = [];
  for (const name of names) {
    try {
      logs(`PubChem-Versuch ${attempt} mit Kandidat "${name}".`);
      const pubchem = await searchCompound(name, debug?.pubchemCalls);
      if (pubchem) {
        logs(`PubChem-Treffer für "${name}" gefunden (CID ${pubchem.cid}).`);
        if (onResolved) onResolved(pubchem.name || name);
        return {
          ...component,
          cid: pubchem.cid,
          cas: pubchem.cas || component.cas,
          name: pubchem.name,
          molecularWeight: pubchem.molecularWeight,
          formula: pubchem.formula,
          density: pubchem.density,
          description: pubchem.description,
          physicalProperties: pubchem.physicalProperties,
          smiles: pubchem.smiles,
          pubchemDetails: pubchem.pubchemDetails || {},
          source: 'pubchem'
        };
      }
      logs(`Kein PubChem-CID für "${name}" gefunden.`);
      attempts.push({ name, result: 'kein Treffer' });
    } catch (error) {
      logs(`PubChem fehlgeschlagen für ${name}: ${error.message}`);
      attempts.push({ name, result: `Fehler: ${error.message}` });
    }
    attempt += 1;
  }

  const retryName = await retryFn(
    component.name,
    input,
    retryPrompt,
    logs,
    {
      attempts,
      extraction: component.extractionContext
    },
    debug?.llmCalls
  );
  if (retryName && !names.includes(retryName)) {
    try {
      logs(`Zweiter LLM-Versuch mit "${retryName}".`);
        const pubchem = await searchCompound(retryName, debug?.pubchemCalls);
        if (pubchem) {
          logs(`PubChem-Treffer nach LLM-Revision: ${retryName}`);
        if (onResolved) onResolved(pubchem.name || retryName);
        return {
          ...component,
          cid: pubchem.cid,
          cas: pubchem.cas || component.cas,
          name: pubchem.name,
          molecularWeight: pubchem.molecularWeight,
          formula: pubchem.formula,
          density: pubchem.density,
          description: pubchem.description,
            physicalProperties: pubchem.physicalProperties,
            smiles: pubchem.smiles,
            pubchemDetails: pubchem.pubchemDetails || {},
            source: 'pubchem'
          };
        }
      logs(`Kein PubChem-CID nach LLM-Revision für "${retryName}" gefunden.`);
    } catch (error) {
      logs(`PubChem fehlgeschlagen für LLM-Vorschlag ${retryName}: ${error.message}`);
    }
  }

  const fallback = findFallback(component.name) || (retryName ? findFallback(retryName) : null);
  if (fallback) {
    logs(`Fallback-Datensatz für ${fallback.name} verwendet.`);
    if (onResolved) onResolved(fallback.name || fallback.query);
    return { ...component, ...fallback, pubchemDetails: fallback.pubchemDetails || {}, source: 'fallback' };
  }

  logs(`Keine Stoffdaten für ${component.name} gefunden – bitte Eingabe prüfen.`);
  return component;
}

async function processWithConcurrency(items, handler, limit) {
  const results = new Array(items.length);
  let index = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= items.length) return;
      try {
        results[currentIndex] = await handler(items[currentIndex], currentIndex);
      } catch (error) {
        results[currentIndex] = {
          ...items[currentIndex],
          source: 'unresolved',
          error: error.message || String(error)
        };
      }
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.allSettled(workers);
  return results;
}

async function analyzeText(input, prompts = {}, adapters = {}) {
  const logs = [];
  let step = 1;
  const log = (message) => logs.push(`${step++}. ${message}`);
  const debug = { llmCalls: [], pubchemCalls: [] };
  const promptSet = {
    primaryPrompt: prompts.primaryPrompt || DEFAULT_PRIMARY_PROMPT,
    retryPrompt: prompts.retryPrompt || DEFAULT_RETRY_PROMPT
  };

  const retryFn = adapters.retryFn || retryCompoundName;
  const extractFn = adapters.extractFn || extractComponentsFromLLM;

  log('Analyse gestartet.');
  const llmExtraction = await extractFn(input, promptSet.primaryPrompt, log, debug.llmCalls);
  const components = (llmExtraction.components || []).map((comp, idx) => ({
    ...comp,
    originalName: comp.name,
    coefficient: comp.coefficient || 1,
    role: comp.role || 'edukt',
    idx,
    extractionContext: llmExtraction.raw
  }));
  log(
    components.length
      ? `LLM-Komponenten extrahiert: ${components
          .map((c) => `${c.name}${c.quantity ? ` (${c.quantity}${c.unit || ''})` : ''}`)
          .join(', ')}.`
      : 'LLM-Komponentenextraktion lieferte keine Treffer.'
  );

  if (!components.length) {
    log('Keine Komponenten gefunden – Berechnung kann nicht durchgeführt werden.');
    return { logs, components: [], summary: 'Keine Komponenten gefunden.', debug };
  }
  const handleComponent = async (component) => {
    const candidates = dedupe([
      component.name,
      component.cas,
      ...(component.aliases || [])
    ]);

    try {
      return await enrichWithChemData(
        component,
        log,
        candidates,
        promptSet.retryPrompt,
        input,
        retryFn,
        undefined,
        debug
      );
    } catch (error) {
      const isTimeout = error?.code === 'PUBCHEM_TIMEOUT';
      const reason = isTimeout ? 'PubChem-Timeout' : 'Anreicherung abgebrochen';
      log(`${reason} für ${component.name}: ${error.message || error}`);

      const fallback = findFallback(component.name) || (component.cas ? findFallback(component.cas) : null);
      if (fallback) {
        log(`Fallback-Datensatz für ${fallback.name} verwendet.`);
        return { ...component, ...fallback, pubchemDetails: fallback.pubchemDetails || {}, source: 'fallback' };
      }

      return { ...component, source: 'unresolved', error: error.message || String(error) };
    }
  };

  const concurrency = Math.max(1, COMPONENT_CONCURRENCY);
  const enriched = await processWithConcurrency(components, handleComponent, concurrency);

  enrichStoichiometry(enriched);

  const limiting = enriched.find((c) => c.limiting);

  return {
    logs,
    components: enriched,
    summary: limiting
      ? `Limiting reagent: ${limiting.name}`
      : 'Keine eindeutige Zuordnung des limiting reagents möglich.',
    debug
  };
}

export { analyzeText };
