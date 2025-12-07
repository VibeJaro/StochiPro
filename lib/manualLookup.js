import { searchCompound } from './pubchem.js';
import { findFallback } from './fallbackData.js';
import { retryCompoundName, DEFAULT_RETRY_PROMPT } from './llm.js';

function dedupe(list = []) {
  return Array.from(new Set(list.filter(Boolean).map((n) => `${n}`.trim())));
}

export async function lookupManualComponent(component, prompts = {}, reactionText = '') {
  const logs = [];
  const debug = { llmCalls: [], pubchemCalls: [] };
  const log = (text) => logs.push(text);
  const retryPrompt = prompts.retryPrompt || DEFAULT_RETRY_PROMPT;

  if (!component || (!component.name && !component.cas)) {
    throw new Error('Komponente ohne Namen oder CAS-Nummer kann nicht gesucht werden.');
  }

  log(`Manuelle PubChem-Suche für "${component.name || component.cas}" gestartet.`);
  const candidates = dedupe([component.name, component.cas, ...(component.aliases || [])]);
  const attempts = [];

  for (const name of candidates) {
    try {
      log(`PubChem-Versuch mit "${name}".`);
      const result = await searchCompound(name, debug.pubchemCalls);
      if (result) {
        log(`Treffer gefunden: CID ${result.cid}.`);
        return {
          component: {
            ...component,
            cid: result.cid,
            name: result.name || component.name,
            molecularWeight: result.molecularWeight ?? component.molecularWeight,
            formula: result.formula || component.formula,
            density: result.density ?? component.density,
            description: result.description || component.description,
            physicalProperties: result.physicalProperties || component.physicalProperties || {},
            pubchemDetails: result.pubchemDetails || component.pubchemDetails || {},
            smiles: result.smiles || component.smiles,
            source: 'pubchem',
            originalSource: component.originalSource || component.source || 'manuell',
            wasEdited: false
          },
          logs,
          debug
        };
      }
      attempts.push({ name, result: 'kein Treffer' });
      log(`Kein PubChem-Treffer für "${name}".`);
    } catch (error) {
      log(`PubChem-Fehler bei "${name}": ${error.message}`);
      attempts.push({ name, result: `Fehler: ${error.message}` });
    }
  }

  const retryName = await retryCompoundName(
    component.name || component.cas,
    reactionText,
    retryPrompt,
    log,
    { attempts },
    debug.llmCalls
  );

  if (retryName && !candidates.includes(retryName)) {
    try {
      log(`LLM-Vorschlag prüfen: "${retryName}".`);
      const result = await searchCompound(retryName, debug.pubchemCalls);
      if (result) {
        log(`LLM-Vorschlag erfolgreich: CID ${result.cid}.`);
        return {
          component: {
            ...component,
            cid: result.cid,
            name: result.name || retryName,
            molecularWeight: result.molecularWeight ?? component.molecularWeight,
            formula: result.formula || component.formula,
            density: result.density ?? component.density,
            description: result.description || component.description,
            physicalProperties: result.physicalProperties || component.physicalProperties || {},
            pubchemDetails: result.pubchemDetails || component.pubchemDetails || {},
            smiles: result.smiles || component.smiles,
            source: 'pubchem',
            originalSource: component.originalSource || component.source || 'manuell',
            wasEdited: false
          },
          logs,
          debug
        };
      }
      log(`Kein Treffer für LLM-Vorschlag "${retryName}".`);
    } catch (error) {
      log(`PubChem-Fehler beim LLM-Vorschlag ${retryName}: ${error.message}`);
    }
  }

  const fallback = findFallback(component.name || retryName || component.cas);
  if (fallback) {
    log(`Fallback-Datensatz genutzt: ${fallback.name}.`);
    return {
      component: {
        ...component,
        ...fallback,
        pubchemDetails: fallback.pubchemDetails || component.pubchemDetails || {},
        source: 'fallback',
        originalSource: component.originalSource || component.source || 'manuell',
        wasEdited: false
      },
      logs,
      debug
    };
  }

  log('Keine Daten gefunden. Bitte Eingabe prüfen.');
  return {
    component,
    logs,
    debug
  };
}
