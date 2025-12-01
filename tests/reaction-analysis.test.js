import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_ANALYSIS_PROMPT, mapAnalysisComponents, runReactionAnalysis } from '../lib/reactionAnalysis.js';

test('mapAnalysisComponents bewahrt GHS- und Physikdaten für die KI-Auswertung', () => {
  const mapped = mapAnalysisComponents([
    {
      name: 'Ethanol',
      role: 'edukt',
      coefficient: 2,
      quantity: 10,
      unit: 'g',
      mass: 10,
      moles: 100,
      equivalents: 1,
      limiting: true,
      molecularWeight: 46.07,
      formula: 'C2H6O',
      density: 0.8,
      cid: 702,
      smiles: 'CCO',
      physicalProperties: { flashPoint: '12 °C', description: 'klarer Alkohol' },
      pubchemDetails: {
        signal: 'Gefahr',
        pictograms: ['GHS02'],
        hazardStatements: ['H225'],
        precautionaryStatements: ['P210'],
        hazardClasses: ['Flam. Liq. 2']
      }
    }
  ]);

  assert.equal(mapped[0].hazard.flashPoint, '12 °C');
  assert.equal(mapped[0].hazard.signal, 'Gefahr');
  assert.deepEqual(mapped[0].hazard.pictograms, ['GHS02']);
  assert.equal(mapped[0].description, 'klarer Alkohol');
});

test('runReactionAnalysis nutzt den übergebenen LLM-Caller und liefert die Antwort zurück', async () => {
  const calls = [];
  const fakeLLM = async (prompt, userMessage, tag) => {
    calls.push({ prompt, userMessage, tag });
    return 'Analyse-Text';
  };

  const result = await runReactionAnalysis(
    [
      {
        name: 'Essigsäure',
        role: 'edukt',
        pubchemDetails: {},
        physicalProperties: {}
      }
    ],
    null,
    'Essigsäure reagiert mit Ethanol zu Ethylacetat.',
    fakeLLM
  );

  assert.equal(result.analysis, 'Analyse-Text');
  assert.equal(result.promptUsed, DEFAULT_ANALYSIS_PROMPT);
  assert.equal(calls[0].tag, 'Reaktionsanalyse');
  assert.ok(calls[0].userMessage.includes('Essigsäure'));
  assert.ok(calls[0].userMessage.includes('Essigsäure reagiert mit Ethanol'));
});

test('runReactionAnalysis gibt Hinweis aus, wenn keine Stoffe übergeben werden', async () => {
  const silentLLM = async () => 'sollte nicht aufgerufen werden';
  const result = await runReactionAnalysis([], 'Eigenes Prompt', null, silentLLM);
  assert.equal(result.analysis, 'Keine Stoffdaten für die Analyse übergeben.');
  assert.equal(result.logs[0], 'Keine Stoffdaten für die Analyse übergeben.');
});
