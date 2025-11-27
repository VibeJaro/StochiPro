import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStoichiometry } from '../lib/stoichiometry.js';

test('calculates equivalents and mass conversions', () => {
  const components = [
    {
      id: 'a',
      name: 'Ethanol',
      role: 'reactant',
      coefficient: 1,
      amount: { value: 4, unit: 'g' },
      pubchem: { molecularWeight: 46.07 },
    },
    {
      id: 'b',
      name: 'Essigsäure',
      role: 'reactant',
      coefficient: 1,
      amount: { value: 2, unit: 'g' },
      pubchem: { molecularWeight: 60.05 },
    },
    {
      id: 'c',
      name: 'Ethylacetat',
      role: 'Produkt',
      coefficient: 1,
      amount: { value: 1, unit: 'mol' },
      pubchem: { molecularWeight: 88.11 },
    },
  ];

  const result = calculateStoichiometry(components);
  const ethanol = result.find((c) => c.id === 'a');
  const acid = result.find((c) => c.id === 'b');
  const ester = result.find((c) => c.id === 'c');

  assert.ok(ethanol.calculated.mmol > 0);
  assert.ok(acid.calculated.mmol > 0);
  assert.ok(ethanol.calculated.equivalents > 1);
  assert.equal(acid.calculated.equivalents, 1); // limiting reagent should be acid
  assert.ok(ester.calculated.mass > 0);
});
