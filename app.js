const state = {
  components: [],
  logs: [],
  selected: null,
  summary: '',
  showLog: true,
  prompts: {
    primaryPrompt:
      'Extrahiere nur explizit genannte Stoffe als JSON (name, cas, quantity, unit, role, coefficient, aliases). Erlaubte Rollen: Edukt, Produkt, Lösemittel, Additiv, Katalysator. Keine erfundenen Werte.',
    retryPrompt:
      'PubChem fand nichts. Nutze den Kontext des fehlgeschlagenen Versuchs und liefere nur alternative Schreibweisen/CAS für die fehlenden Stoffe als JSON-Array von Strings.'
  }
};

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function markEdited(component) {
  component.wasEdited = true;
  if (!component.originalSource) {
    component.originalSource = component.source || 'unbekannt';
  }
  if (component.originalSource === 'pubchem') {
    component.source = 'angepasst';
  } else if (component.originalSource === 'fallback') {
    component.source = 'angepasst';
  } else {
    component.source = component.source || 'manuell';
  }
}

function calculateMassAndMoles(component) {
  const { quantity, unit, molecularWeight, density } = component;
  if (!quantity || !unit) return { mass: null, moles: null };

  if (['g', 'gram', 'grams', 'gramm'].includes(unit)) {
    const mass = quantity;
    return { mass, moles: molecularWeight ? (mass / molecularWeight) * 1000 : null };
  }

  if (unit === 'mg') {
    const mass = quantity / 1000;
    return { mass, moles: molecularWeight ? (mass / molecularWeight) * 1000 : null };
  }

  if (unit === 'mmol') {
    const moles = quantity;
    return { mass: molecularWeight ? (moles / 1000) * molecularWeight : null, moles };
  }

  if (unit === 'mol') {
    const moles = quantity * 1000;
    return { mass: molecularWeight ? quantity * molecularWeight : null, moles };
  }

  if (unit.toLowerCase() === 'ml' || unit === 'mL') {
    if (density) {
      const mass = quantity * density;
      return { mass, moles: molecularWeight ? (mass / molecularWeight) * 1000 : null };
    }
    return { mass: null, moles: null };
  }

  return { mass: null, moles: null };
}

function recomputeStoichiometry() {
  state.components.forEach((component) => {
    component.coefficient = component.coefficient || 1;
    const { mass, moles } = calculateMassAndMoles(component);
    component.mass = mass;
    component.moles = moles;
    component.equivalents = null;
    component.limiting = false;
  });

  const availableMoles = state.components
    .filter((c) => c.moles)
    .map((c) => c.moles / (c.coefficient || 1));

  if (availableMoles.length) {
    const limiting = Math.min(...availableMoles);
    state.components.forEach((component) => {
      if (!component.moles) {
        component.equivalents = null;
        component.limiting = false;
        return;
      }
      component.equivalents = Number(
        (component.moles / (component.coefficient || 1) / limiting).toFixed(2)
      );
      component.limiting = Math.abs(component.equivalents - 1) < 0.05;
    });
  }
}

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

    const source = comp.wasEdited && comp.originalSource === 'pubchem' ? 'angepasst' : comp.source;
    const badgeClass =
      source === 'pubchem'
        ? 'bg-emerald-50 text-emerald-700'
        : source === 'fallback'
          ? 'bg-amber-50 text-amber-700'
          : source === 'angepasst'
            ? 'bg-purple-50 text-purple-700'
            : 'bg-slate-100 text-slate-500';

    tr.innerHTML = `
      <td class="py-2 capitalize">
        <select class="w-full bg-transparent focus:outline-none" onchange="handleInlineEdit(event, ${index}, 'role')">
          ${['edukt', 'produkt', 'lösemittel', 'additiv', 'katalysator']
            .map((role) => `<option value="${role}" ${role === comp.role ? 'selected' : ''}>${role}</option>`)
            .join('')}
        </select>
      </td>
      <td class="align-middle">
        <div class="flex items-center gap-1">
          <input class="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none"
            value="${comp.name || comp.originalName || ''}"
            oninput="handleInlineEdit(event, ${index}, 'name')" />
          ${comp.wasEdited ? '<span class="text-amber-500 text-xs" title="Manuell angepasst">●</span>' : ''}
        </div>
      </td>
      <td><input class="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none"
        value="${comp.formula || ''}" oninput="handleInlineEdit(event, ${index}, 'formula')" /></td>
      <td class="text-right">
        <div class="flex items-center justify-end gap-1">
          <input type="number" step="any" class="w-20 text-right bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none"
            value="${comp.quantity ?? ''}" oninput="handleInlineEdit(event, ${index}, 'quantity', 'number')" placeholder="Menge" />
          <input class="w-16 text-right bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none"
            value="${comp.unit || ''}" oninput="handleInlineEdit(event, ${index}, 'unit')" placeholder="Einheit" />
        </div>
      </td>
      <td class="text-right">${formatNumber(comp.mass)}</td>
      <td class="text-right">${formatNumber(comp.moles)}</td>
      <td class="text-right">${comp.equivalents ? formatNumber(comp.equivalents) : '–'}</td>
      <td class="text-center"><span class="text-xs px-2 py-1 rounded-full ${badgeClass}" title="${
        comp.wasEdited && comp.originalSource === 'pubchem'
          ? 'Aus PubChem geladen, dann manuell angepasst'
          : comp.source === 'pubchem'
            ? 'Automatisch aus PubChem übernommen'
            : comp.source === 'fallback'
              ? 'Fallback-Daten'
              : 'Manuell gepflegt'
      }">${source || 'unbekannt'}</span></td>
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
  const physical = comp.physicalProperties || {};
  const densityValue = physical.density || (comp.density ? `${formatNumber(comp.density)} g/mL` : null);
  const description = comp.description || physical.description;
  const sourceNote =
    comp.wasEdited && comp.originalSource === 'pubchem'
      ? 'Aus PubChem geladen und manuell angepasst.'
      : comp.source === 'pubchem'
        ? 'Automatisch aus PubChem übernommen.'
        : comp.source === 'fallback'
          ? 'Fallback-Daten aus dem lokalen Katalog.'
          : 'Manuell gepflegte Werte.';
  const physicalItems = [
    { label: 'Dichte', value: densityValue },
    { label: 'Schmelzpunkt', value: physical.meltingPoint },
    { label: 'Siedepunkt', value: physical.boilingPoint },
    { label: 'Flammpunkt', value: physical.flashPoint }
  ].filter((entry) => entry.value);
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
    <div class="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
      <div class="text-xs uppercase text-slate-400 mb-1">Quelle</div>
      <div class="text-sm text-slate-700">${sourceNote}</div>
    </div>
    ${
      description
        ? `<div class="mt-4">
            <div class="text-xs uppercase text-slate-400 mb-1">Beschreibung</div>
            <div class="text-sm text-slate-700 leading-relaxed">${description}</div>
          </div>`
        : ''
    }
    <div class="mt-4">
      <div class="text-xs uppercase text-slate-400 mb-1">Physikalische Eigenschaften</div>
      ${
        physicalItems.length
          ? `<ul class="space-y-1">${physicalItems
              .map((item) => `<li class="flex justify-between"><span class="text-slate-500">${item.label}</span><span class="font-mono">${item.value}</span></li>`)
              .join('')}</ul>`
          : '<div class="text-slate-400 text-sm">Keine Angaben.</div>'
      }
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

function handleInlineEdit(event, index, field, type = 'text') {
  event.stopPropagation();
  const comp = state.components[index];
  let value = event.target.value;
  if (type === 'number') {
    value = value === '' ? null : toNumber(value);
  }
  comp[field] = value;
  markEdited(comp);
  recomputeStoichiometry();
  render();
}

function addManualRow() {
  state.components.push({
    name: 'Manuelle Komponente',
    role: 'edukt',
    formula: '',
    quantity: null,
    unit: '',
    coefficient: 1,
    molecularWeight: null,
    density: null,
    mass: null,
    moles: null,
    equivalents: null,
    source: 'manuell',
    originalSource: 'manuell',
    wasEdited: true,
    physicalProperties: { description: '' }
  });
  state.selected = state.components.length - 1;
  recomputeStoichiometry();
  render();
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
    state.components = (data.components || []).map((comp) => ({
      ...comp,
      originalSource: comp.originalSource || comp.source || 'unbekannt',
      wasEdited: false,
      physicalProperties: comp.physicalProperties || {}
    }));
    recomputeStoichiometry();
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
window.addManualRow = addManualRow;
window.handleInlineEdit = handleInlineEdit;

document.getElementById('primaryPrompt').value = state.prompts.primaryPrompt;
document.getElementById('retryPrompt').value = state.prompts.retryPrompt;

render();
