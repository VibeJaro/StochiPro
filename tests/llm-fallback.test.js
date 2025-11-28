import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import * as llm from '../lib/llm.js';

test('analyzeText nutzt LLM-Vorschläge wenn PubChem initial fehlschlägt', async () => {
  const requests = new Map([
    [
      'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/Essigester/cids/JSON',
      { IdentifierList: { CID: [] } }
    ],
    [
      'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/ethyl%20acetate/cids/JSON',
      { IdentifierList: { CID: [111] } }
    ],
    [
      'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/111/synonyms/JSON',
      { InformationList: { Information: [{ Synonym: ['Ethyl acetate'] }] } }
    ],
    [
      'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/111/property/MolecularWeight,MolecularFormula,IsomericSMILES/JSON',
      { PropertyTable: { Properties: [{ MolecularWeight: 88.11, MolecularFormula: 'C4H8O2', IsomericSMILES: 'CCOC(=O)C' }] } }
    ],
    [
      'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/111/JSON',
      { Record: { Section: [] } }
    ]
  ]);

  const fetchCalls = [];

  const restoreFetch = mock.method(globalThis, 'fetch', async (url) => {
    const key = typeof url === 'string' ? url : url.url;
    fetchCalls.push(key);
    if (key.startsWith('https://api.openai.com')) {
      const body = {
        choices: [
          {
            message: { content: '["ethyl acetate"]' }
          }
        ]
      };
      return {
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body)
      };
    }

    if (!requests.has(key)) {
      throw new Error(`Unexpected request: ${key}`);
    }
    const body = requests.get(key);
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body)
    };
  });

  process.env.OPENAI_API_KEY = 'test-key';
  const { analyzeText } = await import('../lib/analyzer.js');

  const result = await analyzeText(
    'Produkt: Essigester',
    {
      primaryPrompt: 'Primärer Testprompt',
      retryPrompt: 'Zweiter Testprompt'
    },
    {
      extractFn: async () => ({
        components: [{ name: 'Essigester', role: 'product' }],
        raw: '[{"name":"Essigester"}]'
      }),
      retryFn: llm.retryCompoundName
    }
  );

  restoreFetch.mock.restore();

  assert.ok(fetchCalls.some((url) => url.includes('Essigester')));
  assert.ok(fetchCalls.some((url) => url.includes('ethyl%20acetate')));
  const enriched = result.components.find((c) => c.formula === 'C4H8O2');
  assert.ok(enriched, 'PubChem-Treffer nach LLM-Revision fehlt');
  assert.equal(enriched.source, 'pubchem');
  assert.ok(result.logs.some((l) => l.toLowerCase().includes('llm')));
});
