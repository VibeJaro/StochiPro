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

function cloneEntry(entry) {
  return JSON.parse(JSON.stringify(entry));
}

function recordStep(entry, stage, payload) {
  if (!entry.steps) entry.steps = [];
  entry.steps.push({ stage, ...payload });
}

async function fetchJsonWithTrace(url, entry, stage, { rethrow = true } = {}) {
  recordStep(entry, stage, { url });
  try {
    const data = await fetchJson(url);
    recordStep(entry, `${stage}:response`, { data });
    return data;
  } catch (error) {
    recordStep(entry, `${stage}:error`, { message: error.message, body: error.body });
    if (rethrow) {
      entry.error = error.message;
      entry.errorBody = error.body || null;
      throw error;
    }
    return null;
  }
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

function extractStrings(section) {
  if (!section) return [];
  const infos = section.Information || [];
  const values = [];
  const push = (val) => {
    if (val === undefined || val === null) return;
    values.push(typeof val === 'string' ? val : String(val));
  };

  infos.forEach((info) => {
    const value = info?.Value || {};
    if (Array.isArray(value.StringWithMarkup)) {
      value.StringWithMarkup.forEach((entry) => {
        push(entry.String);
        if (Array.isArray(entry.Markup)) {
          entry.Markup.forEach((markup) => push(markup.URL || markup.Extra || null));
        }
      });
    }
    if (value.String) push(value.String);
    if (Array.isArray(value.String)) value.String.forEach((entry) => push(entry));
    if (Array.isArray(value.Number)) value.Number.forEach((num) => push(num));
    if (value.Number && !Array.isArray(value.Number)) push(value.Number);
    if (value.NumValue) push(value.NumValue);
    if (value.ExternalDataURL) push(value.ExternalDataURL);
    if (info.URL) {
      if (Array.isArray(info.URL)) {
        info.URL.forEach((entry) => push(entry.URL || entry));
      } else {
        push(info.URL.URL || info.URL);
      }
    }
  });

  return values.filter(Boolean);
}

function extractInformation(section) {
  const strings = extractStrings(section);
  return strings.length ? strings[0] : null;
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
  return parsePhysicalData(viewData);
}

function parsePhysicalData(viewData) {
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

function parsePubchemDetails(viewData, propertiesRow = {}) {
  const sections = viewData?.Record?.Section || [];
  const find = (heading) => findSection(sections, heading);
  const first = (heading) => extractStrings(find(heading))[0] || null;
  const list = (heading) => extractStrings(find(heading));

  const wikipediaSection = find('Wikipedia');
  const wikipediaLink = extractStrings(wikipediaSection).find((entry) => entry.startsWith('http')) || first('Wikipedia');

  return {
    smiles: propertiesRow.IsomericSMILES || first('SMILES') || null,
    wikipedia: wikipediaLink || null,
    xlogp3: first('XLogP3'),
    logP: first('LogP'),
    physicalDescription: first('Physical Description'),
    colorForm: first('Color/Form'),
    solubility: first('Solubility'),
    vaporPressure: first('Vapor Pressure'),
    pKa: first('Dissociation Constants'),
    kovatsRetentionIndex: first('Kovats Retention Index'),
    sourcesUses: first('Sources/Uses'),
    useClassification: first('Use Classification'),
    industryUses: list('Industry Uses'),
    consumerUses: list('Consumer Uses'),
    methodsOfManufacturing: first('Methods of Manufacturing'),
    pictograms: list('Pictogram(s)'),
    signal: first('Signal'),
    hazardStatements: list('GHS Hazard Statements'),
    precautionaryStatements: list('Precautionary Statement Codes'),
    hazardClasses: list('Hazard Classes and Categories'),
    environmentalFate: first('Environmental Fate/Exposure Summary')
  };
}

async function searchCompound(query, trace) {
  const cleanedQuery = normalizeChemicalName(query);
  const entry = { query: cleanedQuery, steps: [] };
  const pushDebug = () => {
    if (trace) {
      trace.push(cloneEntry(entry));
    }
  };

  try {
    const cidData = await fetchJsonWithTrace(
      `${BASE_URL}/compound/name/${encodeURIComponent(cleanedQuery)}/cids/JSON`,
      entry,
      'cidLookup'
    );
    const cid = cidData?.IdentifierList?.CID?.[0];
    entry.cid = cid || null;
    if (!cid) {
      entry.result = 'Kein CID gefunden';
      pushDebug();
      return null;
    }

    const synonymData = await fetchJsonWithTrace(
      `${BASE_URL}/compound/cid/${cid}/synonyms/JSON`,
      entry,
      'synonym'
    );
    const propertiesData = await fetchJsonWithTrace(
      `${BASE_URL}/compound/cid/${cid}/property/MolecularWeight,MolecularFormula,IsomericSMILES/JSON`,
      entry,
      'properties'
    );
    const viewData = await fetchJsonWithTrace(
      `${BASE_URL}_view/data/compound/${cid}/JSON`,
      entry,
      'physical',
      { rethrow: false }
    );

    const synonym = synonymData?.InformationList?.Information?.[0]?.Synonym?.[0] || '';
    const row = propertiesData?.PropertyTable?.Properties?.[0] || {};
    const physical = parsePhysicalData(viewData);
    const details = parsePubchemDetails(viewData, row);

    const result = {
      cid,
      name: synonym || cleanedQuery,
      molecularWeight: row.MolecularWeight,
      formula: row.MolecularFormula,
      density: physical.density,
      description: physical.description || details.physicalDescription || null,
      physicalProperties: physical.physicalProperties,
      smiles: details.smiles,
      pubchemDetails: details
    };
    entry.result = result;
    pushDebug();
    return result;
  } catch (error) {
    entry.error = entry.error || error.message;
    entry.errorBody = entry.errorBody || error.body || null;
    pushDebug();
    throw error;
  }
}

export { searchCompound };
