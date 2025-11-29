import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { searchCompound } from '../lib/pubchem.js';
import { analyzeText } from '../lib/analyzer.js';
import * as pubchem from '../lib/pubchem.js';

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
    ],
    [
      'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/12345/JSON',
      {
        Record: {
          Section: [
            {
              TOCHeading: 'Description',
              Information: [
                {
                  Value: {
                    StringWithMarkup: [{ String: 'Mock Beschreibung' }]
                  }
                }
              ]
            },
            {
              TOCHeading: 'Chemical and Physical Properties',
              Section: [
                {
                  TOCHeading: 'Melting Point',
                  Information: [
                    { Value: { StringWithMarkup: [{ String: '212 F' }] } }
                  ]
                },
                {
                  TOCHeading: 'Boiling Point',
                  Information: [
                    { Value: { StringWithMarkup: [{ String: '350 K' }] } }
                  ]
                },
                {
                  TOCHeading: 'Flash Point',
                  Information: [{ Value: { Number: [32] } }]
                },
                {
                  TOCHeading: 'Density',
                  Information: [
                    { Value: { StringWithMarkup: [{ String: '1.1 g/mL' }] } }
                  ]
                }
              ]
            }
          ]
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
  assert.equal(result.physicalProperties.meltingPoint, '100 °C');
  assert.equal(result.physicalProperties.boilingPoint, '76.9 °C');
  assert.equal(result.physicalProperties.flashPoint, '32 °C');
  assert.equal(result.description, 'Mock Beschreibung');
  assert.equal(result.density, 1.1);

  restoreFetch.mock.restore();
});

test('analyzeText falls back to local dataset when PubChem fails', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    const err = new Error('network down');
    err.status = 503;
    throw err;
  });

  const result = await analyzeText(
    '5 g 4-Ethylphenol, Produkt: irgendwas',
    {},
    {
      extractFn: async () => ({
        components: [
          { name: '4-Ethylphenol', quantity: 5, unit: 'g', role: 'reactant' },
          { name: 'Produkt', role: 'product' }
        ],
        raw: '[{"name":"4-Ethylphenol"}]'
      }),
      retryFn: async () => null
    }
  );

  fetchMock.mock.restore();

  const compound = result.components.find((c) => c.name.toLowerCase().includes('ethylphenol'));
  assert.ok(compound);
  assert.equal(compound.source, 'fallback');
  assert.equal(compound.molecularWeight, 122.17);
});

test('analyzeText queries PubChem per LLM component', async () => {
  const seen = [];
  const responses = new Map();

  const setupCompound = (name, cid) => {
    const base = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound';
    responses.set(
      `${base}/name/${encodeURIComponent(name)}/cids/JSON`,
      { IdentifierList: { CID: [cid] } }
    );
    responses.set(
      `${base}/cid/${cid}/synonyms/JSON`,
      { InformationList: { Information: [{ Synonym: [name] }] } }
    );
    responses.set(
      `${base}/cid/${cid}/property/MolecularWeight,MolecularFormula,IsomericSMILES/JSON`,
      {
        PropertyTable: {
          Properties: [
            {
              MolecularWeight: 1.23,
              MolecularFormula: 'X',
              IsomericSMILES: 'Y'
            }
          ]
        }
      }
    );
    responses.set(
      `${base.replace('/rest/pug', '/rest/pug_view')}/data/compound/${cid}/JSON`,
      { Record: { Section: [] } }
    );
  };

  setupCompound('ethanol', 1);
  setupCompound('essigsäure', 2);
  setupCompound('schwefelsäure', 3);

  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    const key = typeof url === 'string' ? url : url.url;
    const nameMatch = key.match(/name\/([^/]+)\/cids/);
    if (nameMatch) {
      seen.push(decodeURIComponent(nameMatch[1]));
    }

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

  const result = await analyzeText(
    'ethanol, essigsäure, schwefelsäure',
    {},
    {
      extractFn: async () => ({
        components: [
          { name: 'ethanol', role: 'reactant' },
          { name: 'essigsäure', role: 'reactant' },
          { name: 'schwefelsäure', role: 'reactant' }
        ],
        raw: '[{"name":"ethanol"},{"name":"essigsäure"},{"name":"schwefelsäure"}]'
      }),
      retryFn: async () => null
    }
  );

  assert.equal(result.components.length, 3);
  assert.deepEqual(seen, ['ethanol', 'essigsäure', 'schwefelsäure']);
  assert.equal(result.components[0].name, 'ethanol');
  assert.equal(result.components[1].name, 'essigsäure');
  assert.equal(result.components[2].name, 'schwefelsäure');

  fetchMock.mock.restore();
});
