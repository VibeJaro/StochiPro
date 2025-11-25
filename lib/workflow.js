import { searchCompound } from './pubchem.js';
import { calculateStoichiometry } from './stoichiometry.js';
import { heuristicParse } from './parser.js';
import { extractComponentsWithLLM, ensureIds } from './llm.js';

export async function analyzeReaction(text) {
  const logs = [];
  let components = [];

  try {
    const llmComponents = await extractComponentsWithLLM(text);
    if (llmComponents?.length) {
      logs.push('LLM-Extraktion erfolgreich.');
      components = llmComponents;
    }
  } catch (err) {
    logs.push(`LLM-Fehler: ${err.message}`);
  }

  if (!components.length) {
    logs.push('Falle zurück auf heuristische Parserlogik.');
    components = heuristicParse(text);
  }

  components = ensureIds(components);

  // Enrich with PubChem properties
  const enriched = [];
  for (const comp of components) {
    const pubchem = await searchCompound(comp.name).catch((err) => {
      logs.push(`PubChem-Fehler für ${comp.name}: ${err.message}`);
      return null;
    });
    enriched.push({
      ...comp,
      pubchem: pubchem || { source: 'Fallback' },
      logs: comp.logs || [],
    });
  }

  const stoich = calculateStoichiometry(enriched);
  return {
    reactionText: text,
    components: stoich,
    workflowLog: logs,
  };
}
