const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 12000);
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  try {
    const resp = await fetch(url, { ...options, headers, signal: controller.signal });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`PubChem ${resp.status}: ${text || resp.statusText}`);
    }
    return resp.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCids(name) {
  const url = `${BASE}/compound/name/${encodeURIComponent(name)}/cids/JSON`;
  try {
    const json = await fetchJson(url);
    return json?.IdentifierList?.CID || [];
  } catch (err) {
    if (/404/.test(err.message)) return [];
    throw err;
  }
}

async function fetchProperties(cid) {
  const props = ['MolecularFormula', 'MolecularWeight', 'IUPACName'];
  const url = `${BASE}/compound/cid/${cid}/property/${props.join(',')}/JSON`;
  const json = await fetchJson(url);
  const entry = json?.PropertyTable?.Properties?.[0];
  if (!entry) return null;
  return {
    cid: entry.CID,
    formula: entry.MolecularFormula,
    molecularWeight: entry.MolecularWeight,
    iupacName: entry.IUPACName,
    source: 'PubChem'
  };
}

async function fetchSynonyms(cid) {
  const url = `${BASE}/compound/cid/${cid}/synonyms/JSON`;
  const json = await fetchJson(url);
  return json?.InformationList?.Information?.[0]?.Synonym || [];
}

export async function searchCompound(rawTerm) {
  const term = rawTerm?.trim();
  if (!term) throw new Error('Suchbegriff fehlt');

  // 1) Primary name search
  let cids = [];
  try {
    cids = await fetchCids(term);
  } catch (err) {
    throw new Error(`PubChem-Suche fehlgeschlagen (${err.message})`);
  }

  if (!cids.length && term.includes('-')) {
    // fallback: remove hyphen to catch minor naming differences
    cids = await fetchCids(term.replace(/-/g, ' '));
  }

  if (!cids.length) {
    return null;
  }

  const cid = cids[0];
  const properties = await fetchProperties(cid);
  const synonyms = await fetchSynonyms(cid).catch(() => []);

  return {
    cid,
    formula: properties?.formula,
    molecularWeight: properties?.molecularWeight,
    iupacName: properties?.iupacName,
    source: 'PubChem',
    synonyms,
    canonicalName: properties?.iupacName || synonyms?.[0] || term
  };
}
