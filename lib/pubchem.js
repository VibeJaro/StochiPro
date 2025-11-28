const BASE_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

function normalizeChemicalName(name) {
  return name.trim();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'stochipro/1.0'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`PubChem request failed (${res.status})`);
    err.body = text;
    throw err;
  }
  return res.json();
}

async function fetchCidForName(query) {
  const encoded = encodeURIComponent(query);
  const url = `${BASE_URL}/compound/name/${encoded}/cids/JSON`;
  const data = await fetchJson(url);
  const ids = data?.IdentifierList?.CID || [];
  return ids[0] || null;
}

async function fetchSynonym(cid) {
  const url = `${BASE_URL}/compound/cid/${cid}/synonyms/JSON`;
  const data = await fetchJson(url);
  const synonyms = data?.InformationList?.Information?.[0]?.Synonym;
  return synonyms?.[0] || '';
}

function extractFirstString(information) {
  const raw = information?.Value?.StringWithMarkup?.[0]?.String;
  if (raw) return raw;
  const number = information?.Value?.Number?.[0];
  return number !== undefined ? String(number) : null;
}

function findSectionByHeading(section, heading) {
  if (!section) return null;
  if (section.TOCHeading === heading) return section;
  for (const child of section.Section || []) {
    const found = findSectionByHeading(child, heading);
    if (found) return found;
  }
  return null;
}

function parseDensity(raw) {
  if (!raw) return { value: null, unit: null, raw: null };
  const match = raw.match(/([0-9]+[.,]?[0-9]*)\s*(g\s*\/\s*mL|g\s*cm-3|g\s*cm\^3)/i);
  if (!match) return { value: null, unit: null, raw };
  const value = Number(match[1].replace(',', '.'));
  return { value: Number.isFinite(value) ? value : null, unit: 'g/mL', raw };
}

async function fetchProperties(cid) {
  const props = ['MolecularWeight', 'MolecularFormula', 'IsomericSMILES'];
  const url = `${BASE_URL}/compound/cid/${cid}/property/${props.join(',')}/JSON`;
  const data = await fetchJson(url);
  const row = data?.PropertyTable?.Properties?.[0];
  if (!row) return {};
  return {
    molecularWeight: row.MolecularWeight,
    formula: row.MolecularFormula,
    smiles: row.IsomericSMILES
  };
}

async function fetchPhysicalProperties(cid) {
  const url = `${BASE_URL}_view/data/compound/${cid}/JSON`;
  let data;
  try {
    data = await fetchJson(url);
  } catch (error) {
    return {
      density: null,
      densityUnit: null,
      densityRaw: null,
      meltingPoint: null,
      boilingPoint: null,
      appearance: null
    };
  }
  const sections = data?.Record?.Section || [];
  const rootWrapper = { Section: sections };
  const chemSection = findSectionByHeading(rootWrapper, 'Chemical and Physical Properties');
  const densitySection = findSectionByHeading(chemSection, 'Density');
  const meltingSection = findSectionByHeading(chemSection, 'Melting Point');
  const boilingSection = findSectionByHeading(chemSection, 'Boiling Point');
  const appearanceSection = findSectionByHeading(chemSection, 'Color/Form');

  const densityRaw = extractFirstString(densitySection?.Information?.[0]) || null;
  const meltingPoint = extractFirstString(meltingSection?.Information?.[0]) || null;
  const boilingPoint = extractFirstString(boilingSection?.Information?.[0]) || null;
  const appearance = extractFirstString(appearanceSection?.Information?.[0]) || null;
  const parsedDensity = parseDensity(densityRaw);

  return {
    density: parsedDensity.value,
    densityUnit: parsedDensity.unit,
    densityRaw: parsedDensity.raw || densityRaw,
    meltingPoint,
    boilingPoint,
    appearance
  };
}

async function searchCompound(query) {
  const cleanedQuery = normalizeChemicalName(query);
  const cid = await fetchCidForName(cleanedQuery);
  if (!cid) {
    return null;
  }
  const [synonym, properties, physical] = await Promise.all([
    fetchSynonym(cid),
    fetchProperties(cid),
    fetchPhysicalProperties(cid)
  ]);

  return {
    cid,
    name: synonym || cleanedQuery,
    ...properties,
    density: physical.density,
    physicalProperties: physical
  };
}

export { searchCompound };
