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

async function searchCompound(query) {
  const cleanedQuery = normalizeChemicalName(query);
  const cid = await fetchCidForName(cleanedQuery);
  if (!cid) {
    return null;
  }
  const [synonym, properties] = await Promise.all([
    fetchSynonym(cid),
    fetchProperties(cid)
  ]);

  return {
    cid,
    name: synonym || cleanedQuery,
    ...properties
  };
}

export { searchCompound };
