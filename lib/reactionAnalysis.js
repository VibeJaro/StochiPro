import { DEFAULT_ANALYSIS_PROMPT, generateReactionAnalysis } from './llm.js';

function mapAnalysisComponents(components = []) {
  return (components || [])
    .filter(Boolean)
    .map((component) => {
      const physical = component.physicalProperties || {};
      const details = component.pubchemDetails || {};

    return {
      name: component.name,
      role: component.role,
      quantity: component.quantity,
      unit: component.unit,
      coefficient: component.coefficient,
      mass: component.mass,
      moles: component.moles,
      equivalents: component.equivalents,
      limiting: Boolean(component.limiting),
      molecularWeight: component.molecularWeight,
      formula: component.formula,
      density: component.density || physical.density,
      cid: component.cid,
      smiles: component.smiles,
      description: component.description || physical.description || details.physicalDescription,
      hazard: {
        signal: details.signal,
        pictograms: details.pictograms,
        hazardStatements: details.hazardStatements,
        precautionaryStatements: details.precautionaryStatements,
        hazardClasses: details.hazardClasses,
        flashPoint: physical.flashPoint,
        boilingPoint: physical.boilingPoint,
        meltingPoint: physical.meltingPoint
      }
    };
  });
}

async function runReactionAnalysis(components, prompt, reactionText, llmCaller) {
  const logs = [];
  if (!Array.isArray(components) || !components.length) {
    const message = 'Keine Stoffdaten für die Analyse übergeben.';
    return {
      analysis: message,
      promptUsed: prompt || DEFAULT_ANALYSIS_PROMPT,
      logs: [message],
      debug: { llmCalls: [] }
    };
  }

  const debug = { llmCalls: [] };
  const mapped = mapAnalysisComponents(components);
  logs.push(`Reaktionsanalyse gestartet. Übergebene Stoffe: ${mapped.map((c) => c.name).join(', ') || 'n/a'}.`);
  if (reactionText) {
    logs.push(`Reaktionstext vorhanden (${reactionText.slice(0, 60)}${reactionText.length > 60 ? '…' : ''}).`);
  }

  const response = await generateReactionAnalysis(mapped, prompt, logs, debug.llmCalls, llmCaller, reactionText);
  const analysis = response || 'Keine KI-Antwort erhalten (API-Key vorhanden?).';

  return {
    analysis,
    promptUsed: prompt || DEFAULT_ANALYSIS_PROMPT,
    logs,
    debug
  };
}

export { DEFAULT_ANALYSIS_PROMPT, mapAnalysisComponents, runReactionAnalysis };
