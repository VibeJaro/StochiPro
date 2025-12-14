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
      { Record: { Section: [] } }
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

test('searchCompound extrahiert Zusatzfelder aus PubChem-View', async () => {
  const viewData = {
    Record: {
      Section: [
        {
          TOCHeading: 'Names and Identifiers',
          Section: [
            {
              TOCHeading: 'Computed Descriptors',
              Section: [
                {
                  TOCHeading: 'SMILES',
                  Information: [{ Value: { StringWithMarkup: [{ String: 'CCC1=CC(=CC=C1)O' }] } }]
                }
              ]
            },
            {
              TOCHeading: 'Other Identifiers',
              Section: [
                {
                  TOCHeading: 'Wikipedia',
                  Information: [{ URL: [{ URL: 'https://example.com/wiki' }] }]
                }
              ]
            }
          ]
        },
        {
          TOCHeading: 'Chemical and Physical Properties',
          Section: [
            {
              TOCHeading: 'Computed Properties',
              Section: [
                { TOCHeading: 'XLogP3', Information: [{ Value: { Number: [2.4] } }] }
              ]
            },
            {
              TOCHeading: 'Experimental Properties',
              Section: [
                { TOCHeading: 'Physical Description', Information: [{ Value: { StringWithMarkup: [{ String: 'Colorless liquid' }] } }] },
                { TOCHeading: 'Color/Form', Information: [{ Value: { StringWithMarkup: [{ String: 'COLORLESS LIQUID' }] } }] },
                { TOCHeading: 'Solubility', Information: [{ Value: { StringWithMarkup: [{ String: 'Very soluble in alcohol' }] } }] },
                { TOCHeading: 'Vapor Pressure', Information: [{ Value: { StringWithMarkup: [{ String: '0.05 mmHg' }] } }] },
                { TOCHeading: 'LogP', Information: [{ Value: { Number: [2.4] } }] },
                { TOCHeading: 'Dissociation Constants', Information: [{ Value: { StringWithMarkup: [{ String: 'pKa 9.9' }] } }] },
                { TOCHeading: 'Kovats Retention Index', Information: [{ Value: { StringWithMarkup: [{ String: '1140' }] } }] }
              ]
            }
          ]
        },
        {
          TOCHeading: 'Use and Manufacturing',
          Section: [
            {
              TOCHeading: 'Uses',
              Section: [
                { TOCHeading: 'Sources/Uses', Information: [{ Value: { StringWithMarkup: [{ String: 'Photochemicals' }] } }] },
                { TOCHeading: 'Use Classification', Information: [{ Value: { StringWithMarkup: [{ String: 'Fragrance Ingredients' }] } }] },
                { TOCHeading: 'Industry Uses', Information: [{ Value: { StringWithMarkup: [{ String: 'Cleaning agent' }] } }] },
                { TOCHeading: 'Consumer Uses', Information: [{ Value: { StringWithMarkup: [{ String: 'Consumer products' }] } }] }
              ]
            },
            {
              TOCHeading: 'Methods of Manufacturing',
              Information: [{ Value: { StringWithMarkup: [{ String: 'Sulfonation route' }] } }]
            }
          ]
        },
        {
          TOCHeading: 'Safety and Hazards',
          Section: [
            {
              TOCHeading: 'Hazards Identification',
              Section: [
                {
                  TOCHeading: 'GHS Classification',
                  Section: [
                    { TOCHeading: 'Pictogram(s)', Information: [{ Value: { StringWithMarkup: [{ String: 'GHS05' }] } }] },
                    { TOCHeading: 'Signal', Information: [{ Value: { StringWithMarkup: [{ String: 'Danger' }] } }] },
                    {
                      TOCHeading: 'GHS Hazard Statements',
                      Information: [{ Value: { StringWithMarkup: [{ String: 'H314: Causes severe skin burns' }] } }]
                    },
                    {
                      TOCHeading: 'Precautionary Statement Codes',
                      Information: [{ Value: { StringWithMarkup: [{ String: 'P280' }] } }]
                    },
                    {
                      TOCHeading: 'Hazard Classes and Categories',
                      Information: [{ Value: { StringWithMarkup: [{ String: 'Skin Corr. 1B' }] } }]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          TOCHeading: 'Ecological Information',
          Section: [
            {
              TOCHeading: 'Environmental Fate/Exposure Summary',
              Information: [{ Value: { StringWithMarkup: [{ String: 'Degrades in air' }] } }]
            }
          ]
        }
      ]
    }
  };

  const responses = new Map([
    [
      'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/mock-ethylphenol/cids/JSON',
      { IdentifierList: { CID: [999] } }
    ],
    [
      'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/999/synonyms/JSON',
      { InformationList: { Information: [{ Synonym: ['Mock Ethylphenol'] }] } }
    ],
    [
      'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/999/property/MolecularWeight,MolecularFormula,IsomericSMILES/JSON',
      {
        PropertyTable: {
          Properties: [
            { MolecularWeight: 122.17, MolecularFormula: 'C8H10O', IsomericSMILES: 'ROW-SMILES' }
          ]
        }
      }
    ],
    ['https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/999/JSON', viewData]
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

  const result = await searchCompound('mock-ethylphenol');

  assert.equal(result.smiles, 'ROW-SMILES');
  assert.equal(result.pubchemDetails.smiles, 'ROW-SMILES');
  assert.equal(result.pubchemDetails.wikipedia, 'https://example.com/wiki');
  assert.equal(result.pubchemDetails.xlogp3, '2.4');
  assert.equal(result.pubchemDetails.logP, '2.4');
  assert.equal(result.pubchemDetails.physicalDescription, 'Colorless liquid');
  assert.equal(result.pubchemDetails.colorForm, 'COLORLESS LIQUID');
  assert.equal(result.pubchemDetails.solubility, 'Very soluble in alcohol');
  assert.equal(result.pubchemDetails.vaporPressure, '0.05 mmHg');
  assert.equal(result.pubchemDetails.pKa, 'pKa 9.9');
  assert.equal(result.pubchemDetails.kovatsRetentionIndex, '1140');
  assert.equal(result.pubchemDetails.sourcesUses, 'Photochemicals');
  assert.equal(result.pubchemDetails.useClassification, 'Fragrance Ingredients');
  assert.deepEqual(result.pubchemDetails.industryUses, ['Cleaning agent']);
  assert.deepEqual(result.pubchemDetails.consumerUses, ['Consumer products']);
  assert.equal(result.pubchemDetails.methodsOfManufacturing, 'Sulfonation route');
  assert.deepEqual(result.pubchemDetails.pictograms, ['GHS05']);
  assert.equal(result.pubchemDetails.signal, 'Danger');
  assert.deepEqual(result.pubchemDetails.hazardStatements, ['H314: Causes severe skin burns']);
  assert.deepEqual(result.pubchemDetails.precautionaryStatements, ['P280']);
  assert.deepEqual(result.pubchemDetails.hazardClasses, ['Skin Corr. 1B']);
  assert.equal(result.pubchemDetails.environmentalFate, 'Degrades in air');

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
  assert.deepEqual(seen.sort(), ['essigsäure', 'ethanol', 'schwefelsäure'].sort());
  assert.equal(result.components[0].name, 'ethanol');
  assert.equal(result.components[1].name, 'essigsäure');
  assert.equal(result.components[2].name, 'schwefelsäure');

  fetchMock.mock.restore();
});
