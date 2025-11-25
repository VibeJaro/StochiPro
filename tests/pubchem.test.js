import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { searchCompound } from '../lib/pubchem.js';

const originalFetch = global.fetch;

function createMockFetch(sequence) {
  const queue = [...sequence];
  return async (url) => {
    const item = queue.shift();
    if (!item) throw new Error(`No mock response left for ${url}`);
    if (!url.toString().toLowerCase().includes(item.path.toLowerCase())) {
      throw new Error(`Unexpected URL ${url}`);
    }
    const body = JSON.stringify(item.body);
    return new Response(body, {
      status: item.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

afterEach(() => {
  global.fetch = originalFetch;
});

test('finds 4-ethylphenol via primary name search', async () => {
  global.fetch = createMockFetch([
    {
      path: '/rest/pug/compound/name/4-ethylphenol/cids/JSON',
      body: { IdentifierList: { CID: [12345] } },
    },
    {
      path: '/rest/pug/compound/cid/12345/property/MolecularFormula,MolecularWeight,IUPACName/JSON',
      body: { PropertyTable: { Properties: [{ CID: 12345, MolecularFormula: 'C8H10O', MolecularWeight: 122.17, IUPACName: '4-ethylphenol' }] } },
    },
    {
      path: '/rest/pug/compound/cid/12345/synonyms/JSON',
      body: { InformationList: { Information: [{ Synonym: ['4-ethylphenol', 'p-ethylphenol'] }] } },
    },
  ]);

  const result = await searchCompound('4-Ethylphenol');
  assert.equal(result.cid, 12345);
  assert.equal(result.formula, 'C8H10O');
  assert.equal(result.molecularWeight, 122.17);
  assert.ok(result.synonyms.includes('p-ethylphenol'));
});

test('uses hyphen-stripping fallback when initial search fails', async () => {
  global.fetch = createMockFetch([
    { path: '/rest/pug/compound/name/4-ethylphenol/cids/JSON', status: 404, body: { Fault: { Message: 'Not Found' } } },
    { path: '/rest/pug/compound/name/4%20ethylphenol/cids/JSON', body: { IdentifierList: { CID: [789] } } },
    { path: '/rest/pug/compound/cid/789/property/MolecularFormula,MolecularWeight,IUPACName/JSON', body: { PropertyTable: { Properties: [{ CID: 789, MolecularFormula: 'C7H8O', MolecularWeight: 108.12 }] } } },
    { path: '/rest/pug/compound/cid/789/synonyms/JSON', body: { InformationList: { Information: [{ Synonym: ['ethyl phenol'] }] } } },
  ]);

  const result = await searchCompound('4-ethylphenol');
  assert.equal(result.cid, 789);
  assert.equal(result.formula, 'C7H8O');
});
