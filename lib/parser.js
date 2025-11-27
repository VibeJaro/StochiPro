import { toNumber } from './stoichiometry.js';

const UNIT_MAP = {
  g: 'g',
  gramm: 'g',
  gram: 'g',
  grams: 'g',
  mg: 'mg',
  ml: 'ml',
  mL: 'ml',
  mmol: 'mmol',
  mol: 'mol'
};

function parseFreeText(input) {
  const components = [];
  const regex = /(\d+[\d.,]*)\s*(g|gramm|gram|grams|mg|ml|mL|mmol|mol)\s+([^,;\n]+)/gi;
  let match;
  while ((match = regex.exec(input)) !== null) {
    const quantity = toNumber(match[1].replace(',', '.'));
    const rawUnit = match[2];
    const name = match[3].trim();
    components.push({
      name,
      quantity,
      unit: UNIT_MAP[rawUnit] || rawUnit,
      role: 'reactant'
    });
  }

  const productMatch = input.match(/produkt\s*:?\s*([^,;\n]+)/i);
  if (productMatch) {
    components.push({
      name: productMatch[1].trim(),
      role: 'product',
      quantity: null,
      unit: null
    });
  }

  if (!components.length && input.trim()) {
    components.push({
      name: input.trim(),
      role: 'reactant',
      quantity: null,
      unit: null
    });
  }

  if (components.length > 1) {
    components[components.length - 1].role = 'product';
  }

  return components;
}

export { parseFreeText };
