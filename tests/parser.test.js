import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFreeText } from '../lib/parser.js';

test('parseFreeText splits comma-separated names without quantities', () => {
  const result = parseFreeText('ethanol, essigsäure, schwefelsäure');

  assert.equal(result.length, 3);
  assert.deepEqual(result.map((c) => c.name), [
    'ethanol',
    'essigsäure',
    'schwefelsäure'
  ]);
  assert.equal(result[0].role, 'reactant');
  assert.equal(result[1].role, 'reactant');
  assert.equal(result[2].role, 'product');
});
