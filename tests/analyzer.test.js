import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeText } from '../lib/analyzer.js';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

test('runs individual PubChem lookups for each parsed component', async () => {
  const ids = { Ethanol: 11, Essigsäure: 22, Ethylacetat: 33 };
  const calls = [];

  global.fetch = async (url) => {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    calls.push(pathname);

    if (pathname.includes('/cids/JSON')) {
      const name = decodeURIComponent(pathname.split('/compound/name/')[1].split('/cids')[0]);
      const cid = ids[name];
      return new Response(JSON.stringify({ IdentifierList: { CID: [cid] } }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname.includes('/property/')) {
      const cid = Number(pathname.match(/\/cid\/(\d+)/)[1]);
      return new Response(
        JSON.stringify({
          PropertyTable: {
            Properties: [
              { CID: cid, MolecularFormula: `C${cid}H${cid}`, MolecularWeight: cid * 1.5, IUPACName: `Name-${cid}` },
            ],
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (pathname.includes('/synonyms/')) {
      const cid = Number(pathname.match(/\/cid\/(\d+)/)[1]);
      return new Response(JSON.stringify({ InformationList: { Information: [{ Synonym: [`Syn-${cid}`] }] } }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await analyzeText('4 g Ethanol, Essigsäure; Produkt: Ethylacetat');

  assert.equal(result.components.length, 3);
  assert.equal(new Set(result.components.map((c) => c.name)).size, 3);
  assert.equal(calls.length, 9);
});
