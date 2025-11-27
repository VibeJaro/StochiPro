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

async function enrichWithChemData(component, logs, candidateNames, retryPrompt, input) {
  const names = dedupe([component.name, ...candidateNames]);
  for (const name of names) {
    try {
      logs.push(`PubChem-Suche für "${name}" gestartet.`);
      const pubchem = await searchCompound(name);
      if (pubchem) {
        logs.push(`PubChem-Treffer für "${name}" gefunden (CID ${pubchem.cid}).`);
        return {
          ...component,
          cid: pubchem.cid,
          name: pubchem.name,
          molecularWeight: pubchem.molecularWeight,
          formula: pubchem.formula,
          source: 'pubchem'
        };
      }
    } catch (error) {
      logs.push(`PubChem fehlgeschlagen für ${name}: ${error.message}`);
    }
  }

  const retryName = await retryCompoundName(component.name, input, retryPrompt, logs);
  if (retryName && !names.includes(retryName)) {
    try {
      logs.push(`Zweiter LLM-Versuch mit "${retryName}".`);
      const pubchem = await searchCompound(retryName);
      if (pubchem) {
        logs.push(`PubChem-Treffer nach LLM-Revision: ${retryName}`);
        return {
          ...component,
          cid: pubchem.cid,
          name: pubchem.name,
          molecularWeight: pubchem.molecularWeight,
          formula: pubchem.formula,
          source: 'pubchem'
        };
      }
    } catch (error) {
      logs.push(`PubChem fehlgeschlagen für LLM-Vorschlag ${retryName}: ${error.message}`);
    }
  }

  const fallback = findFallback(component.name) || (retryName ? findFallback(retryName) : null);
  if (fallback) {
    logs.push(`Fallback-Datensatz für ${fallback.name} verwendet.`);
    return { ...component, ...fallback, source: 'fallback' };
  }

  logs.push(`Keine Stoffdaten für ${component.name} gefunden – bitte Eingabe prüfen.`);
  return component;
}

async function analyzeText(input, prompts = {}) {
  const logs = [];
  const promptSet = {
    primaryPrompt: prompts.primaryPrompt || DEFAULT_PRIMARY_PROMPT,
    retryPrompt: prompts.retryPrompt || DEFAULT_RETRY_PROMPT
  };

  const llmExtraction = await extractCompoundsFromLLM(input, promptSet.primaryPrompt, logs);
  const llmNames = llmExtraction.compounds || [];

  const components = parseFreeText(input).map((comp) => ({ ...comp, originalName: comp.name }));
  const enriched = [];
  for (const component of components) {
    const enrichedComponent = await enrichWithChemData(component, logs, llmNames, promptSet.retryPrompt, input);
    enriched.push(enrichedComponent);
  }

  enrichStoichiometry(enriched);

  const limiting = enriched.find((c) => c.limiting);

  if (!llmNames.length) {
    logs.push('LLM-Extraktion lieferte keine Kandidaten.');
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
