const fallbackCompounds = [
  {
    query: 'ethanol',
    cid: 702,
    name: 'Ethanol',
    molecularWeight: 46.07,
    formula: 'C2H6O',
    density: 0.789,
    physicalProperties: { density: '0.789 g/mL', boilingPoint: '78.37 °C' }
  },
  {
    query: 'acetic acid',
    cid: 176,
    name: 'Acetic acid',
    molecularWeight: 60.05,
    formula: 'C2H4O2',
    density: 1.049,
    physicalProperties: { density: '1.049 g/mL', boilingPoint: '118.1 °C' }
  },
  {
    query: '4-ethylphenol',
    cid: 12345,
    name: '4-Ethylphenol',
    molecularWeight: 122.17,
    formula: 'C8H10O',
    density: 0.97,
    physicalProperties: { density: '0.97 g/mL' }
  }
];

function findFallback(query) {
  const normalized = query.trim().toLowerCase();
  return fallbackCompounds.find((entry) => normalized.includes(entry.query));
}

export { findFallback };
