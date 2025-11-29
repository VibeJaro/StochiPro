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

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function markManualOverride(component) {
  if (component.source !== 'manuell') {
    component.originalSource = component.source;
  }
  component.source = 'manuell';
  component.manualOverride = true;
}

function ensureCoefficient(component) {
  component.coefficient = component.coefficient || 1;
}

function deriveFromQuantity(component) {
  const { molecularWeight, density } = component;
  const quantity = toNumber(component.quantity);
  if (!quantity || !component.unit) return;

  if (['g', 'gram', 'grams', 'gramm'].includes(component.unit)) {
    component.mass = quantity;
    component.moles = molecularWeight ? (quantity / molecularWeight) * 1000 : component.moles;
    return;
  }

  if (component.unit === 'mg') {
    const mass = quantity / 1000;
    component.mass = mass;
    component.moles = molecularWeight ? (mass / molecularWeight) * 1000 : component.moles;
    return;
  }

  if (component.unit === 'mmol') {
    component.moles = quantity;
    component.mass = molecularWeight ? (quantity / 1000) * molecularWeight : component.mass;
    return;
  }

  if (component.unit === 'mol') {
    component.moles = quantity * 1000;
    component.mass = molecularWeight ? quantity * molecularWeight : component.mass;
    return;
  }

  if (component.unit === 'ml' || component.unit === 'mL') {
    if (density) {
      component.mass = quantity * density;
      component.moles = molecularWeight ? (component.mass / molecularWeight) * 1000 : component.moles;
    }
  }
}

function recomputeFromMass(component) {
  const mass = toNumber(component.mass);
  if (mass === null) return;
  component.mass = mass;
  if (component.molecularWeight) {
    component.moles = Number(((mass / component.molecularWeight) * 1000).toFixed(2));
  }
}

function recomputeFromMoles(component) {
  const moles = toNumber(component.moles);
  if (moles === null) return;
  component.moles = moles;
  if (component.molecularWeight) {
    component.mass = Number(((moles / 1000) * component.molecularWeight).toFixed(3));
  }
}

function recomputeEquivalents() {
  const ratios = state.components
    .filter((c) => toNumber(c.moles))
    .map((c) => toNumber(c.moles) / (c.coefficient || 1));

  if (!ratios.length) {
    state.components.forEach((c) => {
      c.equivalents = null;
      c.limiting = false;
    });
    return;
  }

  const limiting = Math.min(...ratios);
  state.components.forEach((c) => {
    const moles = toNumber(c.moles);
    if (!moles) {
      c.equivalents = null;
      c.limiting = false;
      return;
    }
    const eq = moles / (c.coefficient || 1) / limiting;
    c.equivalents = Number(eq.toFixed(2));
    c.limiting = Math.abs(c.equivalents - 1) < 0.05;
  });
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

  const roleOptions = ['edukt', 'produkt', 'lösemittel', 'additiv', 'katalysator'];
  const unitOptions = ['g', 'mg', 'mol', 'mmol', 'ml'];

  state.components.forEach((comp, index) => {
    ensureCoefficient(comp);
    const tr = document.createElement('tr');
    tr.className = `hover:bg-blue-50 cursor-pointer ${comp.manualOverride ? 'border-l-4 border-amber-400' : ''}`;
    tr.onclick = () => selectComponent(index);

    const stop = (event) => event.stopPropagation();

    const roleTd = document.createElement('td');
    roleTd.className = 'py-2';
    const roleSelect = document.createElement('select');
    roleSelect.className = 'text-sm bg-white border border-slate-200 rounded px-2 py-1 capitalize';
    roleOptions.forEach((role) => {
      const option = document.createElement('option');
      option.value = role;
      option.textContent = role;
      roleSelect.appendChild(option);
    });
    roleSelect.value = comp.role || 'edukt';
    roleSelect.addEventListener('change', (e) => {
      comp.role = e.target.value;
      markManualOverride(comp);
      render();
    });
    roleSelect.addEventListener('click', stop);
    roleTd.appendChild(roleSelect);

    const nameTd = document.createElement('td');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'w-full bg-transparent border-b border-slate-200 focus:border-blue-500 focus:outline-none px-1 py-1';
    nameInput.value = comp.name || comp.originalName || '';
    nameInput.placeholder = 'Name';
    nameInput.addEventListener('change', (e) => {
      comp.name = e.target.value;
      markManualOverride(comp);
      render();
    });
    nameInput.addEventListener('click', stop);
    nameTd.appendChild(nameInput);

    const formulaTd = document.createElement('td');
    const formulaInput = document.createElement('input');
    formulaInput.type = 'text';
    formulaInput.className = 'w-full bg-transparent border-b border-slate-200 focus:border-blue-500 focus:outline-none px-1 py-1';
    formulaInput.value = comp.formula || '';
    formulaInput.placeholder = 'Formel';
    formulaInput.addEventListener('change', (e) => {
      comp.formula = e.target.value;
      markManualOverride(comp);
      render();
    });
    formulaInput.addEventListener('click', stop);
    formulaTd.appendChild(formulaInput);

    const quantityTd = document.createElement('td');
    quantityTd.className = 'text-right';
    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.step = '0.01';
    quantityInput.className = 'w-20 text-right bg-transparent border-b border-slate-200 focus:border-blue-500 focus:outline-none px-1 py-1';
    quantityInput.value = comp.quantity ?? '';
    quantityInput.placeholder = 'Menge';
    quantityInput.addEventListener('change', (e) => {
      const value = toNumber(e.target.value);
      comp.quantity = value;
      if (value === null) {
        comp.mass = null;
        comp.moles = null;
      } else {
        deriveFromQuantity(comp);
      }
      markManualOverride(comp);
      recomputeEquivalents();
      render();
    });
    quantityInput.addEventListener('click', stop);

    const unitSelect = document.createElement('select');
    unitSelect.className = 'ml-2 text-sm bg-white border border-slate-200 rounded px-2 py-1';
    unitOptions.forEach((unit) => {
      const option = document.createElement('option');
      option.value = unit;
      option.textContent = unit;
      unitSelect.appendChild(option);
    });
    unitSelect.value = comp.unit || 'g';
    unitSelect.addEventListener('change', (e) => {
      comp.unit = e.target.value;
      deriveFromQuantity(comp);
      markManualOverride(comp);
      recomputeEquivalents();
      render();
    });
    unitSelect.addEventListener('click', stop);

    quantityTd.appendChild(quantityInput);
    quantityTd.appendChild(unitSelect);

    const massTd = document.createElement('td');
    massTd.className = 'text-right';
    const massInput = document.createElement('input');
    massInput.type = 'number';
    massInput.step = '0.001';
    massInput.className = 'w-24 text-right bg-transparent border-b border-slate-200 focus:border-blue-500 focus:outline-none px-1 py-1';
    massInput.value = comp.mass ?? '';
    massInput.placeholder = 'g';
    massInput.addEventListener('change', (e) => {
      const value = toNumber(e.target.value);
      comp.mass = value;
      if (value === null) {
        comp.moles = null;
      } else {
        recomputeFromMass(comp);
      }
      markManualOverride(comp);
      recomputeEquivalents();
      render();
    });
    massInput.addEventListener('click', stop);
    massTd.appendChild(massInput);

    const molesTd = document.createElement('td');
    molesTd.className = 'text-right';
    const molesInput = document.createElement('input');
    molesInput.type = 'number';
    molesInput.step = '0.01';
    molesInput.className = 'w-24 text-right bg-transparent border-b border-slate-200 focus:border-blue-500 focus:outline-none px-1 py-1';
    molesInput.value = comp.moles ?? '';
    molesInput.placeholder = 'mmol';
    molesInput.addEventListener('change', (e) => {
      const value = toNumber(e.target.value);
      comp.moles = value;
      if (value === null) {
        comp.mass = null;
      } else {
        recomputeFromMoles(comp);
      }
      markManualOverride(comp);
      recomputeEquivalents();
      render();
    });
    molesInput.addEventListener('click', stop);
    molesTd.appendChild(molesInput);

    const eqTd = document.createElement('td');
    eqTd.className = 'text-right text-sm';
    if (comp.equivalents) {
      const badge = document.createElement('span');
      badge.textContent = formatNumber(comp.equivalents);
      badge.className = `px-2 py-1 rounded-full ${comp.limiting ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`;
      eqTd.appendChild(badge);
    } else {
      eqTd.textContent = '–';
    }

    const sourceTd = document.createElement('td');
    sourceTd.className = 'text-center';
    const sourceBadge = document.createElement('span');
    const sourceLabel = comp.manualOverride ? 'manuell (überschrieben)' : comp.source || 'unbekannt';
    const baseClass = 'text-xs px-2 py-1 rounded-full inline-flex items-center gap-1';
    const colorClass = comp.manualOverride
      ? 'bg-amber-50 text-amber-700'
      : comp.source === 'pubchem'
      ? 'bg-emerald-50 text-emerald-700'
      : comp.source === 'fallback'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-slate-100 text-slate-500';
    sourceBadge.className = `${baseClass} ${colorClass}`;
    sourceBadge.textContent = sourceLabel;
    sourceTd.appendChild(sourceBadge);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'ml-2 text-slate-400 hover:text-red-600';
    removeBtn.title = 'Zeile entfernen';
    removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.components.splice(index, 1);
      if (state.selected === index) state.selected = null;
      recomputeEquivalents();
      render();
    });
    sourceTd.appendChild(removeBtn);

    tr.appendChild(roleTd);
    tr.appendChild(nameTd);
    tr.appendChild(formulaTd);
    tr.appendChild(quantityTd);
    tr.appendChild(massTd);
    tr.appendChild(molesTd);
    tr.appendChild(eqTd);
    tr.appendChild(sourceTd);

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
  const physicalItems = [
    { label: 'Dichte', value: densityValue },
    { label: 'Schmelzpunkt', value: physical.meltingPoint },
    { label: 'Siedepunkt', value: physical.boilingPoint },
    { label: 'Flammpunkt', value: physical.flashPoint }
  ].filter((entry) => entry.value);
  const sourceLabel = comp.manualOverride ? 'manuell (überschrieben)' : comp.source || 'unbekannt';
  const description = comp.description || physical.description;
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
      <div>
        <div class="text-xs uppercase text-slate-400">Quelle</div>
        <div class="text-sm"><span class="px-2 py-1 rounded-full ${
          comp.manualOverride
            ? 'bg-amber-50 text-amber-700'
            : comp.source === 'pubchem'
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-slate-100 text-slate-600'
        }">${sourceLabel}</span></div>
      </div>
    </div>
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
    ${
      description
        ? `<div class="mt-4"><div class="text-xs uppercase text-slate-400 mb-1">Beschreibung</div><div class="text-sm leading-relaxed text-slate-700">${description}</div></div>`
        : ''
    }
  `;
}

function renderSummary() {
  const summaryEl = document.getElementById('summary');
  summaryEl.textContent = state.summary || '';
}

function render() {
  if (state.selected !== null && !state.components[state.selected]) {
    state.selected = null;
  }
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
    state.components = (data.components || []).map((comp) => ({
      ...comp,
      manualOverride: false
    }));
    state.logs = data.logs || [];
    state.summary = data.summary || '';
    state.selected = null;
    recomputeEquivalents();
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
window.addManualComponent = function addManualComponent() {
  state.components.push({
    name: 'Neuer Stoff',
    role: 'edukt',
    formula: '',
    quantity: null,
    unit: 'g',
    mass: null,
    moles: null,
    coefficient: 1,
    source: 'manuell',
    manualOverride: true
  });
  state.selected = state.components.length - 1;
  render();
};

document.getElementById('primaryPrompt').value = state.prompts.primaryPrompt;
document.getElementById('retryPrompt').value = state.prompts.retryPrompt;

render();
