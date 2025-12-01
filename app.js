const DEFAULT_ANALYSIS_PROMPT = `
Du bist ein Labor-KI-Assistent, der chemische Reaktionen bewertet.
Liefere eine kompakte, fachliche Einschätzung mit folgenden Blöcken:
- Kurzfassung: Reaktion in 1-2 Sätzen zusammenfassen (Edukte ➜ Produkte, Mengen grob einordnen).
- Sicherheit: Nenne wesentliche Risiken (z. B. GHS-Hinweise, Flammpunkte, Reaktivität) und Sofortmaßnahmen.
- Optimierung: Mache Vorschläge für schonendere/effizientere Reaktionsführung (Reihenfolge, Temperatur, Alternativen bei Lösemitteln/Katalysatoren).
- Analytik: Empfiehl geeignete Analytik (z. B. NMR, GC-MS, HPLC, IR, Titration) inkl. sinnvoller Kontrolle der Edukte/Produkte.
Nutze sowohl den vollständigen Reaktionstext (Ziel, Temperatur, Zeit, Setup, Lösungsmittel, Besonderheiten) als auch die übergebenen Stoffdaten (Name, Rolle, Mengen, physikalische Daten, GHS).
Antwort klar gegliedert mit Stichpunkten und kurzen Erläuterungen in Deutsch.`;

const state = {
  reactionText: '',
  components: [],
  logs: [],
  selected: null,
  summary: '',
  analysis: {
    prompt: DEFAULT_ANALYSIS_PROMPT,
    output: '',
    status: ''
  },
  debug: {
    llmCalls: [],
    pubchemCalls: []
  },
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

function setAnalysisStatus(text) {
  state.analysis.status = text;
  const status = document.getElementById('analysisStatus');
  if (status) {
    if (text) {
      status.textContent = text;
      status.classList.remove('hidden');
    } else {
      status.textContent = '';
      status.classList.add('hidden');
    }
  }
}

function resetUI() {
  document.getElementById('reactionInput').value = '';
  document.getElementById('primaryPrompt').value = state.prompts.primaryPrompt;
  document.getElementById('retryPrompt').value = state.prompts.retryPrompt;
  state.reactionText = '';
  state.components = [];
  state.logs = [];
  state.selected = null;
  state.summary = '';
  state.analysis = { prompt: state.analysis.prompt || DEFAULT_ANALYSIS_PROMPT, output: '', status: '' };
  state.debug = { llmCalls: [], pubchemCalls: [] };
  document.getElementById('analysisPrompt').value = state.analysis.prompt;
  render();
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return Number(value).toFixed(digits);
}

function escapeHtml(text) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdown(text) {
  const safeText = escapeHtml(text || '');
  const withStrong = safeText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const lines = withStrong.split(/\r?\n/);
  const blocks = [];
  let listBuffer = [];

  const flushList = () => {
    if (listBuffer.length) {
      blocks.push(`<ul class="list-disc pl-5 space-y-1">${listBuffer.map((item) => `<li>${item}</li>`).join('')}</ul>`);
      listBuffer = [];
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^[-*]\s+/, ''));
      return;
    }

    flushList();

    if (/^#{1,3}\s+/.test(trimmed)) {
      const level = Math.min(trimmed.match(/^#+/)[0].length, 3);
      const content = trimmed.replace(/^#{1,3}\s+/, '');
      blocks.push(`<h${level} class="font-semibold text-slate-700">${content}</h${level}>`);
      return;
    }

    blocks.push(`<p class="mb-2">${trimmed}</p>`);
  });

  flushList();

  if (!blocks.length) {
    return '<p class="text-slate-500">Noch keine Analyse gestartet.</p>';
  }

  return blocks.join('\n');
}

function renderLogs() {
  const container = document.getElementById('logList');
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

function renderDebugDetails() {
  const llmContainer = document.getElementById('llmDebug');
  const pubchemContainer = document.getElementById('pubchemDebug');
  if (!llmContainer || !pubchemContainer) return;

  const addCodeBlock = (target, label, text) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'mt-2';
    const lbl = document.createElement('div');
    lbl.className = 'text-xs uppercase text-slate-400';
    lbl.textContent = label;
    const pre = document.createElement('pre');
    pre.className = 'bg-slate-900 text-white text-xs p-2 rounded-lg overflow-x-auto whitespace-pre-wrap';
    pre.textContent = text || '–';
    wrapper.appendChild(lbl);
    wrapper.appendChild(pre);
    target.appendChild(wrapper);
  };

  llmContainer.innerHTML = '';
  if (!state.debug.llmCalls?.length) {
    llmContainer.innerHTML = '<p class="text-slate-400 text-sm">Keine LLM-Aufrufe protokolliert.</p>';
  } else {
    state.debug.llmCalls.forEach((call, idx) => {
      const card = document.createElement('div');
      card.className = 'border border-slate-200 rounded-lg p-3 bg-white';
      const title = document.createElement('div');
      title.className = 'font-semibold text-sm text-slate-700';
      title.textContent = `${idx + 1}. ${call.tag || 'LLM-Aufruf'}`;
      card.appendChild(title);
      addCodeBlock(card, 'System-Prompt', call.systemPrompt);
      addCodeBlock(card, 'User-Message', call.userMessage);
      if (call.error) {
        addCodeBlock(card, 'Fehler', call.error);
      }
      addCodeBlock(card, 'LLM-Antwort', call.response || '[leer]');
      llmContainer.appendChild(card);
    });
  }

  pubchemContainer.innerHTML = '';
  if (!state.debug.pubchemCalls?.length) {
    pubchemContainer.innerHTML = '<p class="text-slate-400 text-sm">Noch keine PubChem-Anfragen protokolliert.</p>';
  } else {
    state.debug.pubchemCalls.forEach((entry, idx) => {
      const card = document.createElement('div');
      card.className = 'border border-slate-200 rounded-lg p-3 bg-white space-y-2';
      const title = document.createElement('div');
      title.className = 'font-semibold text-sm text-slate-700';
      title.textContent = `${idx + 1}. PubChem: ${entry.query}`;
      card.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'text-xs text-slate-500';
      meta.textContent = entry.result ? 'Treffer protokolliert' : entry.error ? `Fehler: ${entry.error}` : 'Kein Ergebnis';
      card.appendChild(meta);

      (entry.steps || []).forEach((step) => {
        const block = document.createElement('div');
        block.className = 'bg-slate-50 border border-slate-200 rounded p-2';
        const heading = document.createElement('div');
        heading.className = 'text-xs font-semibold text-slate-600';
        heading.textContent = step.stage;
        block.appendChild(heading);
        if (step.url) {
          const urlEl = document.createElement('div');
          urlEl.className = 'text-[11px] text-blue-700 break-all';
          urlEl.textContent = step.url;
          block.appendChild(urlEl);
        }
        if (step.data || step.response || step.body || step.message) {
          const payload = step.data || step.response || step.body || step.message;
          const pre = document.createElement('pre');
          pre.className = 'bg-white border border-slate-200 rounded mt-1 text-[11px] p-2 overflow-x-auto whitespace-pre-wrap';
          pre.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
          block.appendChild(pre);
        }
        card.appendChild(block);
      });

      if (entry.result) {
        const resultBlock = document.createElement('div');
        resultBlock.className = 'bg-emerald-50 border border-emerald-200 rounded p-2 text-xs';
        resultBlock.textContent = `Treffer: CID ${entry.result.cid || entry.cid || 'n/a'} · ${entry.result.name || entry.query}`;
        card.appendChild(resultBlock);
      }

      if (entry.error) {
        const errorBlock = document.createElement('div');
        errorBlock.className = 'bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700';
        errorBlock.textContent = `Fehler: ${entry.error}`;
        card.appendChild(errorBlock);
      }

      pubchemContainer.appendChild(card);
    });
  }
}

function renderTable() {
  const tbody = document.getElementById('componentTable');
  tbody.innerHTML = '';
  if (!state.components.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="py-4 text-center text-slate-400">Noch keine Daten.</td></tr>';
    return;
  }

  state.components.forEach((comp, index) => {
    const tr = document.createElement('tr');
    const isSelected = state.selected === index;
    tr.className = `${isSelected ? 'bg-blue-50/60' : ''} hover:bg-blue-50`;

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
      <td class="text-center align-middle">
        <input type="radio" name="componentSelect" ${isSelected ? 'checked' : ''} onclick="selectComponent(${index})" aria-label="Komponente auswählen" />
      </td>
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
    panel.textContent = 'Keine Auswahl. Wählen Sie eine Stoffzeile aus, um Details zu sehen.';
    return;
  }
  const comp = state.components[state.selected];
  const physical = comp.physicalProperties || {};
  const detail = comp.pubchemDetails || {};
  const densityValue = physical.density || (comp.density ? `${formatNumber(comp.density)} g/mL` : null);
  const description = comp.description || physical.description || detail.physicalDescription;
  const sourceNote =
    comp.wasEdited && comp.originalSource === 'pubchem'
      ? 'Aus PubChem geladen und manuell angepasst.'
      : comp.source === 'pubchem'
        ? 'Automatisch aus PubChem übernommen.'
        : comp.source === 'fallback'
          ? 'Fallback-Daten aus dem lokalen Katalog.'
          : 'Manuell gepflegte Werte.';

  const toArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : value ? [value] : []);
  const renderKeyValueList = (items) =>
    `<ul class="divide-y divide-slate-100">${items
      .map(
        (item) =>
          `<li class="py-1 flex justify-between gap-4"><span class="text-slate-500">${item.label}</span><span class="text-sm text-right">${
            item.value && item.value !== '' ? item.value : '–'
          }</span></li>`
      )
      .join('')}</ul>`;

  const renderBulletList = (items, placeholder = 'Keine Angaben.') => {
    if (items.length) {
      return `<ul class="list-disc list-inside space-y-1">${items.map((entry) => `<li>${entry}</li>`).join('')}</ul>`;
    }
    return `<div class="text-sm text-slate-400">${placeholder}</div>`;
  };

  const renderPills = (items, placeholder = 'Keine Angaben.') => {
    if (items.length) {
      return `<div class="flex flex-wrap gap-2">${items
        .map((entry) => `<span class="px-2 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs">${entry}</span>`)
        .join('')}</div>`;
    }
    return `<div class="text-sm text-slate-400">${placeholder}</div>`;
  };

  const physicalItems = [
    { label: 'Dichte', value: densityValue },
    { label: 'Schmelzpunkt', value: physical.meltingPoint },
    { label: 'Siedepunkt', value: physical.boilingPoint },
    { label: 'Flammpunkt', value: physical.flashPoint },
    { label: 'Physikalische Beschreibung', value: detail.physicalDescription },
    { label: 'Farbe/Form', value: detail.colorForm },
    { label: 'Löslichkeit', value: detail.solubility },
    { label: 'Dampfdruck', value: detail.vaporPressure }
  ];

  const descriptorItems = [
    { label: 'SMILES', value: comp.smiles || detail.smiles },
    { label: 'XLogP3', value: detail.xlogp3 },
    { label: 'LogP (experimentell)', value: detail.logP },
    { label: 'pKa', value: detail.pKa },
    { label: 'Kovats-Retentionsindex', value: detail.kovatsRetentionIndex }
  ];

  panel.innerHTML = `
    <div class="grid md:grid-cols-3 gap-4">
      <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
        <div class="text-xs uppercase text-slate-400">Name</div>
        <div class="font-semibold text-lg">${comp.name}</div>
        <div class="text-xs uppercase text-slate-400">Formel</div>
        <div>${comp.formula || '–'}</div>
        <div class="text-xs uppercase text-slate-400">Molekulargewicht</div>
        <div>${comp.molecularWeight ? `${formatNumber(comp.molecularWeight)} g/mol` : '–'}</div>
      </div>
      <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
        <div class="text-xs uppercase text-slate-400">PubChem CID</div>
        <div>${comp.cid || '–'}</div>
        <div class="text-xs uppercase text-slate-400">Masse</div>
        <div>${formatNumber(comp.mass)} g</div>
        <div class="text-xs uppercase text-slate-400">Stoffmenge</div>
        <div>${formatNumber(comp.moles)} mmol</div>
      </div>
      <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
        <div class="text-xs uppercase text-slate-400">SMILES</div>
        <div class="font-mono text-sm break-words">${comp.smiles || detail.smiles || '–'}</div>
        <div class="text-xs uppercase text-slate-400">Wikipedia</div>
        <div>
          ${
            detail.wikipedia
              ? `<a class="text-blue-700 hover:underline break-words" href="${detail.wikipedia}" target="_blank" rel="noreferrer">${detail.wikipedia}</a>`
              : '<span class="text-slate-400">–</span>'
          }
        </div>
      </div>
    </div>

    <div class="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
      <div class="text-xs uppercase text-slate-400 mb-1">Quelle</div>
      <div class="text-sm text-slate-700">${sourceNote}</div>
    </div>

    <div class="mt-4 grid lg:grid-cols-2 gap-4">
      <div class="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-slate-700">Beschreibung & Physik</h3>
          <span class="text-xs text-slate-500">PubChem Experimental</span>
        </div>
        ${
          description
            ? `<div class="text-sm text-slate-700 leading-relaxed">${description}</div>`
            : '<div class="text-sm text-slate-400">Keine Beschreibung gefunden.</div>'
        }
        ${renderKeyValueList(physicalItems)}
      </div>
      <div class="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-slate-700">Struktur & Verteilung</h3>
          <span class="text-xs text-slate-500">LogP / pKa / Retention</span>
        </div>
        ${renderKeyValueList(descriptorItems)}
      </div>
    </div>

    <div class="mt-4 grid lg:grid-cols-2 gap-4">
      <div class="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-slate-700">Verwendung & Herstellung</h3>
          <span class="text-xs text-slate-500">Use & Manufacturing</span>
        </div>
        ${renderKeyValueList([
          { label: 'Sources/Uses', value: detail.sourcesUses },
          { label: 'Use Classification', value: detail.useClassification },
          { label: 'Methods of Manufacturing', value: detail.methodsOfManufacturing }
        ])}
        <div>
          <div class="text-xs uppercase text-slate-400">Industrieeinsatz</div>
          ${renderPills(toArray(detail.industryUses))}
        </div>
        <div>
          <div class="text-xs uppercase text-slate-400">Consumer Uses</div>
          ${renderPills(toArray(detail.consumerUses))}
        </div>
      </div>
      <div class="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-slate-700">Sicherheit (GHS)</h3>
          <span class="text-xs text-slate-500">Hazard Statements & Codes</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs uppercase text-slate-400">Signalwort</span>
          <span class="px-2 py-1 rounded-full text-xs ${detail.signal ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-500'}">${
            detail.signal || '–'
          }</span>
        </div>
        <div>
          <div class="text-xs uppercase text-slate-400">Piktogramme</div>
          ${renderPills(toArray(detail.pictograms))}
        </div>
        <div>
          <div class="text-xs uppercase text-slate-400">GHS Hazard Statements (H-Sätze)</div>
          ${renderBulletList(toArray(detail.hazardStatements))}
        </div>
        <div>
          <div class="text-xs uppercase text-slate-400">Precautionary Statement Codes (P-Sätze)</div>
          ${renderPills(toArray(detail.precautionaryStatements))}
        </div>
        <div>
          <div class="text-xs uppercase text-slate-400">Gefahrklassen & Kategorien</div>
          ${renderBulletList(toArray(detail.hazardClasses))}
        </div>
      </div>
    </div>

    <div class="mt-4 bg-white border border-slate-200 rounded-lg p-4 space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-slate-700">Umweltfate / Exposition</h3>
        <span class="text-xs text-slate-500">Ecological Information</span>
      </div>
      ${
        detail.environmentalFate
          ? `<div class="text-sm text-slate-700 leading-relaxed">${detail.environmentalFate}</div>`
          : '<div class="text-sm text-slate-400">Keine Umweltangaben gefunden.</div>'
      }
    </div>
  `;
}

function renderSummary() {
  const summaryEl = document.getElementById('summary');
  summaryEl.textContent = state.summary || '';
}

function renderAnalysis() {
  const output = document.getElementById('analysisOutput');
  const prompt = document.getElementById('analysisPrompt');
  const status = document.getElementById('analysisStatus');
  if (!output || !prompt || !status) return;

  output.innerHTML = state.analysis.output
    ? renderMarkdown(state.analysis.output)
    : '<p class="text-slate-500">Noch keine Analyse gestartet.</p>';
  if (prompt.value !== state.analysis.prompt) {
    prompt.value = state.analysis.prompt;
  }

  if (state.analysis.status) {
    status.textContent = state.analysis.status;
    status.classList.remove('hidden');
  } else {
    status.textContent = '';
    status.classList.add('hidden');
  }
}

function render() {
  renderLogs();
  renderTable();
  renderDetail();
  renderSummary();
  renderAnalysis();
  renderDebugDetails();
}

function selectComponent(index) {
  state.selected = index;
  render();
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

function handleAnalysisPromptChange(event) {
  state.analysis.prompt = event.target.value;
}

async function runReactionAnalysis() {
  if (!state.components.length) {
    state.analysis.output = '';
    setAnalysisStatus('Keine Stoffdaten geladen – bitte zuerst die Reaktion analysieren.');
    renderAnalysis();
    return;
  }

  const btn = document.getElementById('analysisBtn');
  const prompt = document.getElementById('analysisPrompt').value || DEFAULT_ANALYSIS_PROMPT;

  state.analysis.prompt = prompt;
  setAnalysisStatus('KI-Analyse läuft ...');
  btn.disabled = true;
  btn.classList.add('opacity-70');

  try {
    const response = await fetch('/api/reaction-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ components: state.components, prompt, reactionText: state.reactionText })
    });

    if (!response.ok) {
      throw new Error(`Serverfehler (${response.status})`);
    }

    const data = await response.json();
    state.analysis.output = data.analysis || 'Keine Antwort erhalten.';
    const latestNonAnswerLog = (data.logs || [])
      .slice()
      .reverse()
      .find((log) => !log.startsWith('LLM (Reaktionsanalyse) Antwort'));
    setAnalysisStatus(latestNonAnswerLog || 'KI-Antwort erhalten.');

    if (Array.isArray(data?.debug?.llmCalls) && data.debug.llmCalls.length) {
      state.debug.llmCalls.push(...data.debug.llmCalls);
    }
    renderDebugDetails();
  } catch (error) {
    state.analysis.output = '';
    setAnalysisStatus(`Fehler: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-70');
    renderAnalysis();
  }
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
    physicalProperties: { description: '' },
    pubchemDetails: {},
    smiles: ''
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

  state.reactionText = text;
  state.prompts.primaryPrompt = document.getElementById('primaryPrompt').value || state.prompts.primaryPrompt;
  state.prompts.retryPrompt = document.getElementById('retryPrompt').value || state.prompts.retryPrompt;
  state.analysis.prompt = document.getElementById('analysisPrompt').value || state.analysis.prompt;
  state.analysis.output = '';
  setAnalysisStatus('KI-Analyse wartet auf manuellen Start.');

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
      physicalProperties: comp.physicalProperties || {},
      pubchemDetails: comp.pubchemDetails || {},
      smiles: comp.smiles || (comp.pubchemDetails && comp.pubchemDetails.smiles) || ''
    }));
    recomputeStoichiometry();
    state.logs = data.logs || [];
    state.summary = data.summary || '';
    state.debug = data.debug || { llmCalls: [], pubchemCalls: [] };
    state.selected = state.components.length ? 0 : null;
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
window.addManualRow = addManualRow;
window.handleInlineEdit = handleInlineEdit;
window.runReactionAnalysis = runReactionAnalysis;
window.handleAnalysisPromptChange = handleAnalysisPromptChange;

document.getElementById('primaryPrompt').value = state.prompts.primaryPrompt;
document.getElementById('retryPrompt').value = state.prompts.retryPrompt;
document.getElementById('analysisPrompt').value = state.analysis.prompt;

render();
