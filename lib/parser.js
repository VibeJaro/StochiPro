import crypto from 'node:crypto';

const MASS_REGEX = /(\d+(?:\.\d+)?)\s*(g|gramm|grams)/i;
const MOL_REGEX = /(\d+(?:\.\d+)?)\s*(mmol|mol)/i;
const QUANTIFIED_COMPONENT = /(\d+(?:\.\d+)?)\s*(g|gramm|grams|mmol|mol)\s*([^,;]+)/gi;

export function heuristicParse(input) {
  const segments = input.split(/[,;+]/).map((s) => s.trim()).filter(Boolean);
  const components = [];
  segments.forEach((segment) => {
    const massMatch = segment.match(MASS_REGEX);
    const molMatch = segment.match(MOL_REGEX);
    const quantity = massMatch || molMatch;
    const unit = quantity ? quantity[2] : null;
    const value = quantity ? Number(quantity[1]) : null;
    const name = segment.replace(quantity?.[0] || '', '').replace(/produkt[:]?/i, '').trim();
    if (!name) return;
    const role = /produkt/i.test(segment) ? 'Produkt' : 'Edukt';
    components.push({
      id: crypto.randomUUID(),
      name: name.trim(),
      role,
      coefficient: 1,
      amount: quantity ? { value, unit } : undefined,
      logs: ['Heuristische Analyse ohne LLM']
    });
  });
  return components;
}

export function parseFreeText(input) {
  if (!input || typeof input !== 'string') return [];

  const components = [];
  const seen = new Set();

  const pushComponent = (component) => {
    const key = component.name.toLowerCase();
    if (seen.has(key)) return;
    components.push({
      id: crypto.randomUUID(),
      coefficient: 1,
      logs: ['Freitext-Parser'],
      ...component,
    });
    seen.add(key);
  };

  for (const match of input.matchAll(QUANTIFIED_COMPONENT)) {
    const [, value, unit, rawName] = match;
    const name = rawName.replace(/produkt[:]*/i, '').trim();
    if (!name) continue;
    const role = /produkt/i.test(rawName) ? 'Produkt' : 'Edukt';
    pushComponent({
      name,
      role,
      amount: { value: Number(value), unit },
    });
  }

  const segments = input.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  segments.forEach((segment) => {
    const massMatch = segment.match(MASS_REGEX);
    const molMatch = segment.match(MOL_REGEX);
    const quantity = massMatch || molMatch;
    const unit = quantity ? quantity[2] : null;
    const value = quantity ? Number(quantity[1]) : null;
    const name = segment.replace(quantity?.[0] || '', '').replace(/produkt[:]?/i, '').trim();
    if (!name) return;
    const role = /produkt/i.test(segment) ? 'Produkt' : 'Edukt';
    pushComponent({
      name,
      role,
      amount: quantity ? { value, unit } : undefined,
    });
  });

  return components;
}
