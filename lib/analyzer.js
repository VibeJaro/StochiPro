import { searchCompound } from './pubchem.js';
import { findFallback } from './fallbackData.js';
import { enrichStoichiometry } from './stoichiometry.js';
import { parseFreeText } from './parser.js';
import {
  DEFAULT_PRIMARY_PROMPT,
  DEFAULT_RETRY_PROMPT,
  extractCompoundsFromLLM,
  retryCompoundName
} from './llm.js';

function dedupe(list) {
  return Array.from(new Set(list.filter(Boolean).map((n) => n.trim())));
}

function buildCandidates(component, llmNames, usedNames = new Set()) {
  const normalizedComp = component.name.toLowerCase();
  const primaryMatches = llmNames.filter((candidate) => {
    const normalizedCandidate = candidate.toLowerCase();
    return (
      normalizedCandidate === normalizedComp ||
      normalizedCandidate.includes(normalizedComp) ||
      normalizedComp.includes(normalizedCandidate)
    );
  });

  const unusedOthers = llmNames.filter(
    (candidate) =>
      !primaryMatches.includes(candidate) && !usedNames.has(candidate.toLowerCase())
  );

  const previouslyUsed = llmNames.filter(
    (candidate) =>
      !primaryMatches.includes(candidate) && usedNames.has(candidate.toLowerCase())
  );

  return dedupe([component.name, ...primaryMatches, ...unusedOthers, ...previouslyUsed]);
}

async function enrichWithChemData(
  component,
  logs,
  candidateNames,
  retryPrompt,
  input,
  onResolved
) {
  const names = dedupe([component.name, ...candidateNames]);
  logs(`Anreicherung für Komponente "${component.originalName || component.name}" gestartet.`);
  let attempt = 1;
  for (const name of names) {
    try {
      logs(`PubChem-Versuch ${attempt} mit Kandidat "${name}".`);
      const pubchem = await searchCompound(name);
      if (pubchem) {
        logs(`PubChem-Treffer für "${name}" gefunden (CID ${pubchem.cid}).`);
        if (onResolved) onResolved(pubchem.name || name);
        return {
          ...component,
          cid: pubchem.cid,
          name: pubchem.name,
          molecularWeight: pubchem.molecularWeight,
          formula: pubchem.formula,
          source: 'pubchem'
        };
      }
      logs(`Kein PubChem-CID für "${name}" gefunden.`);
    } catch (error) {
      logs(`PubChem fehlgeschlagen für ${name}: ${error.message}`);
    }
    attempt += 1;
  }

  const retryName = await retryCompoundName(component.name, input, retryPrompt, logs);
  if (retryName && !names.includes(retryName)) {
    try {
      logs(`Zweiter LLM-Versuch mit "${retryName}".`);
      const pubchem = await searchCompound(retryName);
      if (pubchem) {
        logs(`PubChem-Treffer nach LLM-Revision: ${retryName}`);
        if (onResolved) onResolved(pubchem.name || retryName);
        return {
          ...component,
          cid: pubchem.cid,
          name: pubchem.name,
          molecularWeight: pubchem.molecularWeight,
          formula: pubchem.formula,
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
    return { ...component, ...fallback, source: 'fallback' };
  }

  logs(`Keine Stoffdaten für ${component.name} gefunden – bitte Eingabe prüfen.`);
  return component;
}

async function analyzeText(input, prompts = {}) {
  const logs = [];
  let step = 1;
  const log = (message) => logs.push(`${step++}. ${message}`);
  const promptSet = {
    primaryPrompt: prompts.primaryPrompt || DEFAULT_PRIMARY_PROMPT,
    retryPrompt: prompts.retryPrompt || DEFAULT_RETRY_PROMPT
  };

  log('Analyse gestartet.');
  const llmExtraction = await extractCompoundsFromLLM(input, promptSet.primaryPrompt, log);
  const llmNames = llmExtraction.compounds || [];
  log(`LLM-Kandidaten extrahiert: ${llmNames.length ? llmNames.join(', ') : 'keine Treffer'}.`);

  const components = parseFreeText(input).map((comp) => ({ ...comp, originalName: comp.name }));
  log(`Parser erkannte ${components.length} Komponenten.`);
  const enriched = [];
  const usedCandidates = new Set();
  for (const component of components) {
    const candidates = buildCandidates(component, llmNames, usedCandidates);
    const enrichedComponent = await enrichWithChemData(
      component,
      log,
      candidates,
      promptSet.retryPrompt,
      input,
      (resolvedName) => {
        if (resolvedName) usedCandidates.add(resolvedName.toLowerCase());
      }
    );
    enriched.push(enrichedComponent);
  }

  enrichStoichiometry(enriched);

  const limiting = enriched.find((c) => c.limiting);

  if (!llmNames.length) {
    log('LLM-Extraktion lieferte keine Kandidaten.');
  }

  return {
    logs,
    components: enriched,
    summary: limiting
      ? `Limiting reagent: ${limiting.name}`
      : 'Keine eindeutige Zuordnung des limiting reagents möglich.'
  };
}

export { analyzeText };
