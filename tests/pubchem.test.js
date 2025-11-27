import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { searchCompound } from '../lib/pubchem.js';
import { analyzeText } from '../lib/analyzer.js';

test('searchCompound resolves PubChem data for names with hyphens', async () => {
  const responses = new Map([
    [
      'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/4-ethylphenol/cids/JSON',
      { IdentifierList: { CID: [12345] } }
    ],
    [
      'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/12345/synonyms/JSON',
      { InformationList: { Information: [{ Synonym: ['Mock 4-ethylphenol'] }] } }
    ],
    [
      'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/12345/property/MolecularWeight,MolecularFormula,IsomericSMILES/JSON',
      {
        PropertyTable: {
          Properties: [{ MolecularWeight: 122.17, MolecularFormula: 'C8H10O', IsomericSMILES: 'C2H5C6H4O' }]
        }
      }
    ]
  ]);

  const restoreFetch = mock.method(globalThis, 'fetch', async (url) => {
    const key = typeof url === 'string' ? url : url.url;
    if (!responses.has(key)) {
      throw new Error(`Unexpected request: ${key}`);
    }
    const body = responses.get(key);
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body)
    };
  });

  const result = await searchCompound('4-ethylphenol');
  assert.ok(result);
  assert.equal(result.cid, 12345);
  assert.equal(result.name, 'Mock 4-ethylphenol');
  assert.equal(result.formula, 'C8H10O');

  restoreFetch.mock.restore();
});

test('analyzeText falls back to local dataset when PubChem fails', async () => {
  const restore = mock.method(globalThis, 'fetch', async () => {
    const err = new Error('network down');
    err.status = 503;
    throw err;
  });

  const result = await analyzeText('5 g 4-Ethylphenol, Produkt: irgendwas');
  restore.mock.restore();

  const compound = result.components.find((c) => c.name.toLowerCase().includes('ethylphenol'));
  assert.ok(compound);
  assert.equal(compound.source, 'fallback');
  assert.equal(compound.molecularWeight, 122.17);
});
