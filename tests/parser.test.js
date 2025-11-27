import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFreeText } from '../lib/parser.js';

test('parses quantified and unquantified components separated by commas/semicolons', () => {
  const input = '4 g Ethanol, Essigsäure; Produkt: Ethylacetat';
  const components = parseFreeText(input);

  assert.equal(components.length, 3);
  assert.deepEqual(
    components.map((c) => c.name),
    ['Ethanol', 'Essigsäure', 'Ethylacetat']
  );

  const ethanol = components.find((c) => c.name === 'Ethanol');
  assert.equal(ethanol.amount.value, 4);
  assert.equal(ethanol.amount.unit.toLowerCase(), 'g');

  const product = components.find((c) => c.role === 'Produkt');
  assert.equal(product.name, 'Ethylacetat');
});
