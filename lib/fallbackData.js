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
    query: '3-ethylphenol',
    cid: 7569,
    name: '3-Ethylphenol',
    molecularWeight: 122.17,
    formula: 'C8H10O',
    density: 0.98,
    description: 'Colorless liquid used as intermediate for photo chemicals.',
    smiles: 'CCC1=CC(=CC=C1)O',
    physicalProperties: {
      description: 'Colorless liquid',
      density: '0.98 g/mL',
      boilingPoint: '218 °C',
      flashPoint: '99 °C'
    },
    pubchemDetails: {
      smiles: 'CCC1=CC(=CC=C1)O',
      wikipedia: 'https://en.wikipedia.org/wiki/3-Ethylphenol',
      xlogp3: '2.4',
      logP: '2.40',
      physicalDescription: 'Colorless liquid',
      colorForm: 'COLORLESS LIQUID',
      solubility: 'SLIGHTLY SOLUBLE IN WATER, CHLOROFORM; VERY SOLUBLE IN ALCOHOL, ETHER',
      vaporPressure: '0.05 mmHg (25 °C)',
      pKa: '9.9',
      kovatsRetentionIndex: '1140–1180',
      sourcesUses: 'Used as a starting material for photochemicals',
      useClassification: 'Fragrance Ingredients',
      industryUses: ['Cleaning agent', 'Corrosion inhibitor'],
      consumerUses: ['Consumer use categories not detailed (database classification)'],
      methodsOfManufacturing:
        'Sulfonation of ethylbenzene followed by alkaline fusion of 3-ethylbenzenesulfonic acid and isomerization/hydrolysis steps.',
      pictograms: ['GHS05', 'GHS06', 'GHS07'],
      signal: 'Danger',
      hazardStatements: [
        'H301 (39%): Toxic if swallowed',
        'H311 (39%): Toxic in contact with skin',
        'H314 (62.5%): Causes severe skin burns and eye damage',
        'H302+H312+H332 (20%): Harmful if swallowed, in contact with skin or if inhaled',
        'H315 (36%): Causes skin irritation'
      ],
      precautionaryStatements: ['P280', 'P301+P310', 'P303+P361+P353', 'P305+P351+P338', 'P260'],
      hazardClasses: [
        'Acute toxicity (oral) – Category 3',
        'Acute toxicity (dermal) – Category 3',
        'Skin corrosion – Category 1B',
        'Skin irritation – Category 2'
      ],
      environmentalFate:
        'Released via wastewater and smoke; degrades in air within hours via OH radicals, moderate soil mobility (Koc ~480), biodegrades in water and soil over weeks with limited bioaccumulation (BCF ~40).'
    }
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
