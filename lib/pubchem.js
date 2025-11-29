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

function findSection(sections = [], heading) {
  for (const section of sections) {
    if (section?.TOCHeading === heading) return section;
    const nested = findSection(section.Section || [], heading);
    if (nested) return nested;
  }
  return null;
}

function extractInformation(section) {
  const info = section?.Information?.[0];
  if (!info) return null;
  if (info.Value?.StringWithMarkup?.[0]?.String) {
    return info.Value.StringWithMarkup[0].String;
  }
  if (Array.isArray(info.Value?.Number) && info.Value.Number.length) {
    return info.Value.Number[0];
  }
  return null;
}

function parseDensity(value) {
  if (!value) return null;
  const match = String(value).match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : null;
}

function extractFirstNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const match = String(value).match(/-?[0-9]+(?:\.[0-9]+)?/);
  return match ? Number(match[0]) : null;
}

function normalizeTemperature(value) {
  if (!value) return null;
  const numeric = extractFirstNumber(value);
  if (numeric === null) return value;

  const lower = String(value).toLowerCase();
  let celsius = numeric;

  if (lower.includes('f')) {
    celsius = ((numeric - 32) * 5) / 9;
  } else if (lower.includes('k')) {
    celsius = numeric - 273.15;
  }

  const rounded = Number(celsius.toFixed(1));
  return `${rounded} °C`;
}

async function fetchPhysicalProperties(cid) {
  const viewUrl = `${BASE_URL}_view/data/compound/${cid}/JSON`;
  const viewData = await fetchJson(viewUrl).catch(() => null);

  const sections = viewData?.Record?.Section || [];
  const get = (heading) => extractInformation(findSection(sections, heading));

  const physicalProperties = {
    meltingPoint: normalizeTemperature(get('Melting Point')),
    boilingPoint: normalizeTemperature(get('Boiling Point')),
    density: get('Density') || null,
    flashPoint: normalizeTemperature(get('Flash Point'))
  };

  const densityValue = parseDensity(physicalProperties.density);

  const descriptionSection = findSection(sections, 'Description');
  const description = extractInformation(descriptionSection);

  return {
    density: densityValue || null,
    physicalProperties,
    description: description || null
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
    physicalProperties: physical.physicalProperties,
    description: physical.description
  };
}

export { searchCompound };
