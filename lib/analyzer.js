import { searchCompound } from './pubchem.js';
import { findFallback } from './fallbackData.js';
import { enrichStoichiometry } from './stoichiometry.js';
import { parseFreeText } from './parser.js';

async function enrichWithChemData(component, logs) {
  const fallback = findFallback(component.name);
  try {
    const pubchem = await searchCompound(component.name);
    if (pubchem) {
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
    logs.push(`PubChem fehlgeschlagen für ${component.name}: ${error.message}`);
  }

  if (fallback) {
    logs.push(`Fallback-Datensatz für ${component.name} verwendet.`);
    return { ...component, ...fallback, source: 'fallback' };
  }

  logs.push(`Keine Stoffdaten für ${component.name} gefunden.`);
  return component;
}

async function analyzeText(input) {
  const logs = [];
  const components = parseFreeText(input);
  const enriched = [];
  for (const component of components) {
    const enrichedComponent = await enrichWithChemData(component, logs);
    enriched.push(enrichedComponent);
  }

  enrichStoichiometry(enriched);

  const limiting = enriched.find((c) => c.limiting);

  return {
    logs,
    components: enriched,
    summary: limiting
      ? `Limiting reagent: ${limiting.name}`
      : 'Keine eindeutige Zuordnung des limiting reagents möglich.'
  };
}

export { analyzeText };
