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

function toCelsius(value) {
  if (!value && value !== 0) return null;
  const raw = String(value);
  const match = raw.match(/(-?[0-9]+(?:\.[0-9]+)?)/);
  if (!match) return raw;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return raw;

  if (/k(elvin)?/i.test(raw) || /\sK\b/i.test(raw)) {
    const celsius = numeric - 273.15;
    return `${celsius.toFixed(2)} °C`;
  }
  if (/f(ahrenheit)?/i.test(raw) || /°F/i.test(raw)) {
    const celsius = ((numeric - 32) * 5) / 9;
    return `${celsius.toFixed(2)} °C`;
  }

  return raw.includes('°C') || /\bC\b/.test(raw) ? raw : `${numeric} °C`;
}

function parseDensity(value) {
  if (!value) return null;
  const match = String(value).match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : null;
}

async function fetchPhysicalProperties(cid) {
  const viewUrl = `${BASE_URL}_view/data/compound/${cid}/JSON`;
  const viewData = await fetchJson(viewUrl).catch(() => null);

  const sections = viewData?.Record?.Section || [];
  const get = (heading) => extractInformation(findSection(sections, heading));

  const physicalProperties = {
    meltingPoint: toCelsius(get('Melting Point')) || null,
    boilingPoint: toCelsius(get('Boiling Point')) || null,
    density: get('Density') || null,
    flashPoint: toCelsius(get('Flash Point')) || null,
    description: get('Description') || null
  };

  const densityValue = parseDensity(physicalProperties.density);

  return {
    density: densityValue || null,
    physicalProperties,
    description: physicalProperties.description || null
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
    description: physical.description,
    physicalProperties: physical.physicalProperties
  };
}

export { searchCompound };
