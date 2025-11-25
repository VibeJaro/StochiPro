const input = document.getElementById('reactionInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const clearBtn = document.getElementById('clearBtn');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('statusText');
const statusIcon = document.getElementById('statusIcon');
const tableBody = document.getElementById('stoichBody');
const detailEmpty = document.getElementById('detailEmpty');
const detailContent = document.getElementById('detailContent');
const detailName = document.getElementById('detailName');
const detailFormula = document.getElementById('detailFormula');
const detailCid = document.getElementById('detailCid');
const detailM = document.getElementById('detailM');
const detailSource = document.getElementById('detailSource');
const detailLog = document.getElementById('detailLog');

let currentResult = null;

function setStatus(visible, text, icon = '⏳') {
  if (!visible) {
    statusEl.style.display = 'none';
    return;
  }
  statusEl.style.display = 'flex';
  statusText.textContent = text;
  statusIcon.textContent = icon;
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return Number(value).toFixed(digits);
}

function renderTable(result) {
  if (!result || !result.components?.length) {
    tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);">Noch keine Berechnung durchgeführt.</td></tr>';
    return;
  }

  tableBody.innerHTML = '';
  result.components.forEach((item) => {
    const tr = document.createElement('tr');
    tr.className = 'table-row';
    tr.addEventListener('click', () => renderDetails(item));

    const role = document.createElement('td');
    role.innerHTML = `<span class="role">${item.role}</span>`;
    const name = document.createElement('td');
    name.textContent = item.name;
    const formula = document.createElement('td');
    formula.className = 'secondary';
    formula.textContent = item.pubchem?.formula || '–';
    const mw = document.createElement('td');
    mw.textContent = formatNumber(item.pubchem?.molecularWeight);
    const coeff = document.createElement('td');
    coeff.textContent = formatNumber(item.coefficient, 0);
    const n = document.createElement('td');
    n.textContent = formatNumber(item.calculated?.mmol, 1);
    const m = document.createElement('td');
    m.textContent = formatNumber(item.calculated?.mass, 3);
    const eq = document.createElement('td');
    eq.textContent = formatNumber(item.calculated?.equivalents, 2);

    [role, name, formula, mw, coeff, n, m, eq].forEach((td) => tr.appendChild(td));
    tableBody.appendChild(tr);
  });
}

function renderDetails(item) {
  detailEmpty.style.display = 'none';
  detailContent.style.display = 'block';
  detailName.textContent = item.name;
  detailFormula.textContent = item.pubchem?.formula || '–';
  detailCid.textContent = item.pubchem?.cid || '–';
  detailM.textContent = item.pubchem?.molecularWeight ? `${formatNumber(item.pubchem.molecularWeight, 3)} g/mol` : '–';
  detailSource.textContent = item.pubchem?.source || 'PubChem';
  detailLog.textContent = (item.logs || []).join('\n') || 'Keine zusätzlichen Hinweise';
}

async function process() {
  const text = input.value.trim();
  if (!text) return;
  setStatus(true, 'LLM analysiert Eingabe...');
  try {
    const resp = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text })
    });
    if (!resp.ok) {
      throw new Error(`Server antwortet mit ${resp.status}`);
    }
    const json = await resp.json();
    currentResult = json;
    renderTable(json);
    setStatus(false);
    if (json.components?.[0]) renderDetails(json.components[0]);
  } catch (err) {
    console.error(err);
    setStatus(true, err.message || 'Fehler', '⚠️');
  }
}

function clearAll() {
  input.value = '';
  currentResult = null;
  renderTable(null);
  detailEmpty.style.display = 'block';
  detailContent.style.display = 'none';
  setStatus(false);
}

analyzeBtn.addEventListener('click', process);
clearBtn.addEventListener('click', clearAll);

// Allow Ctrl+Enter trigger
input.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    process();
  }
});

// Seed with sample text for quick tryout
input.value = '4 g Ethanol, 8 g Essigsäure, Produkt: Ethylacetat';
