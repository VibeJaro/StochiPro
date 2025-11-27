const state = {
  components: [],
  logs: [],
  selected: null,
  summary: '',
  showLog: true,
  prompts: {
    primaryPrompt:
      'Du bist ein Chemie-Extraktionsagent für Stöchiometrie. Antworte nur mit JSON-Array von Objekten (name, cas, quantity, unit, role, coefficient, aliases).',
    retryPrompt:
      'Wir haben keine Treffer in PubChem gefunden. Finde eine alternative englische Schreibweise oder CAS-Nummer für die genannte Substanz. Antworte nur mit einem JSON-Array aus Strings.'
  }
};

function setStatus(text) {
  const status = document.getElementById('statusText');
  if (text) {
    status.textContent = text;
    status.classList.remove('hidden');
  } else {
    status.classList.add('hidden');
  }
}

function resetUI() {
  document.getElementById('reactionInput').value = '';
  document.getElementById('primaryPrompt').value = state.prompts.primaryPrompt;
  document.getElementById('retryPrompt').value = state.prompts.retryPrompt;
  state.components = [];
  state.logs = [];
  state.selected = null;
  state.summary = '';
  render();
}

function toggleLog() {
  state.showLog = !state.showLog;
  renderLogs();
  renderToggle();
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return Number(value).toFixed(digits);
}

function renderLogs() {
  const container = document.getElementById('logList');
  container.classList.toggle('hidden', !state.showLog);
  container.innerHTML = '';
  if (!state.logs.length) {
    container.innerHTML = '<p class="text-slate-400">Noch keine Logs.</p>';
    return;
  }
  state.logs.forEach((line) => {
    const entry = document.createElement('div');
    entry.className = 'bg-slate-50 border border-slate-200 rounded-lg p-2';
    entry.textContent = line;
    container.appendChild(entry);
  });
}

function renderTable() {
  const tbody = document.getElementById('componentTable');
  tbody.innerHTML = '';
  if (!state.components.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="py-4 text-center text-slate-400">Noch keine Daten.</td></tr>';
    return;
  }

  state.components.forEach((comp, index) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-blue-50 cursor-pointer';
    tr.onclick = () => selectComponent(index);
    tr.innerHTML = `
      <td class="py-2 capitalize">${comp.role || ''}</td>
      <td>${comp.name || comp.originalName || 'Unbekannt'}</td>
      <td>${comp.formula || '–'}</td>
      <td class="text-right">${comp.quantity ? `${comp.quantity} ${comp.unit || ''}` : '–'}</td>
      <td class="text-right">${formatNumber(comp.mass)}</td>
      <td class="text-right">${formatNumber(comp.moles)}</td>
      <td class="text-right">${comp.equivalents ? formatNumber(comp.equivalents) : '–'}</td>
      <td class="text-center"><span class="text-xs px-2 py-1 rounded-full ${comp.source === 'pubchem' ? 'bg-emerald-50 text-emerald-700' : comp.source === 'fallback' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}">${comp.source || 'unbekannt'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDetail() {
  const panel = document.getElementById('detailPanel');
  if (state.selected === null) {
    panel.textContent = 'Keine Auswahl.';
    return;
  }
  const comp = state.components[state.selected];
  panel.innerHTML = `
    <div class="grid grid-cols-2 gap-4">
      <div>
        <div class="text-xs uppercase text-slate-400">Name</div>
        <div class="font-semibold">${comp.name}</div>
      </div>
      <div>
        <div class="text-xs uppercase text-slate-400">Formel</div>
        <div>${comp.formula || '–'}</div>
      </div>
      <div>
        <div class="text-xs uppercase text-slate-400">Molekulargewicht</div>
        <div>${comp.molecularWeight ? `${formatNumber(comp.molecularWeight)} g/mol` : '–'}</div>
      </div>
      <div>
        <div class="text-xs uppercase text-slate-400">PubChem CID</div>
        <div>${comp.cid || '–'}</div>
      </div>
      <div>
        <div class="text-xs uppercase text-slate-400">Masse</div>
        <div>${formatNumber(comp.mass)} g</div>
      </div>
      <div>
        <div class="text-xs uppercase text-slate-400">Stoffmenge</div>
        <div>${formatNumber(comp.moles)} mmol</div>
      </div>
    </div>
  `;
}

function renderSummary() {
  const summaryEl = document.getElementById('summary');
  summaryEl.textContent = state.summary || '';
}

function render() {
  renderLogs();
  renderTable();
  renderDetail();
  renderSummary();
  renderToggle();
}

function selectComponent(index) {
  state.selected = index;
  renderDetail();
}

function renderToggle() {
  const label = document.getElementById('toggleLogLabel');
  label.textContent = state.showLog ? 'Log ausblenden' : 'Log anzeigen';
  const icon = document.querySelector('#toggleLog i');
  if (icon) {
    icon.className = state.showLog ? 'fa-solid fa-angle-down mr-1' : 'fa-solid fa-angle-right mr-1';
  }
}

async function processInput() {
  const text = document.getElementById('reactionInput').value;
  if (!text.trim()) {
    setStatus('Bitte geben Sie eine Reaktionsbeschreibung ein.');
    return;
  }

  state.prompts.primaryPrompt = document.getElementById('primaryPrompt').value || state.prompts.primaryPrompt;
  state.prompts.retryPrompt = document.getElementById('retryPrompt').value || state.prompts.retryPrompt;

  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  btn.classList.add('opacity-70');
  setStatus('Analyse läuft...');

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, prompts: state.prompts })
    });

    if (!response.ok) {
      throw new Error(`Serverfehler (${response.status})`);
    }
    const data = await response.json();
    state.components = data.components || [];
    state.logs = data.logs || [];
    state.summary = data.summary || '';
    state.selected = null;
    render();
    setStatus('Analyse abgeschlossen.');
  } catch (error) {
    console.error(error);
    setStatus(`Fehler: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-70');
    setTimeout(() => setStatus(''), 2000);
  }
}

window.processInput = processInput;
window.resetUI = resetUI;
window.toggleLog = toggleLog;

document.getElementById('primaryPrompt').value = state.prompts.primaryPrompt;
document.getElementById('retryPrompt').value = state.prompts.retryPrompt;

render();
