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
  detailExpanded: false,
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

function getSourceBadge(component) {
  const source = component.wasEdited && component.originalSource === 'pubchem' ? 'angepasst' : component.source;
  const badgeClass =
    source === 'pubchem'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : source === 'angepasst'
        ? 'bg-amber-50 text-amber-700 border border-amber-200'
        : source === 'fallback'
          ? 'bg-purple-50 text-purple-700 border border-purple-200'
          : 'bg-slate-100 text-slate-600 border border-slate-200';

  return { label: source || 'unbekannt', badgeClass };
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
  state.detailExpanded = false;
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
  let listRoots = [];
  let listStack = [];

  const renderListTree = (items) => {
    if (!items.length) return '';
    return `<ul class="list-disc pl-5 space-y-1">${items
      .map((item) => `<li>${item.content}${renderListTree(item.children)}</li>`)
      .join('')}</ul>`;
  };

  const flushList = () => {
    if (listRoots.length) {
      blocks.push(renderListTree(listRoots));
      listRoots = [];
      listStack = [];
    }
  };

  lines.forEach((line) => {
    if (!line.trim()) {
      flushList();
      return;
    }

    const listMatch = line.match(/^(\s*)([-*])\s+(.+)$/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const level = Math.floor(indent / 2);
      const content = listMatch[3].trim();

      while (listStack.length > level) {
        listStack.pop();
      }

      const node = { content, children: [] };

      if (level === 0 || !listStack.length) {
        if (level === 0) {
          listStack = [];
        }
        listRoots.push(node);
        listStack[0] = node;
      } else {
        const parent = listStack[level - 1];
        if (parent) {
          parent.children.push(node);
          listStack[level] = node;
        } else {
          listRoots.push(node);
          listStack = [node];
        }
      }
      return;
    }

    flushList();

    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3);
      const sizeClass = level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : 'text-lg';
      const content = headingMatch[2];
      blocks.push(`<h${level} class="${sizeClass} font-semibold text-slate-800 mb-2">${content}</h${level}>`);
      return;
    }

    blocks.push(`<p class="mb-2 leading-relaxed text-slate-700">${trimmed}</p>`);
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
    tbody.innerHTML = '<tr><td colspan="10" class="py-4 text-center text-slate-400">Noch keine Daten.</td></tr>';
    return;
  }

  state.components.forEach((comp, index) => {
    const tr = document.createElement('tr');
    const isSelected = state.selected === index;
    const { badgeClass, label: sourceLabel } = getSourceBadge(comp);
    const showPubchemButton = comp.source === 'manuell' || comp.source === 'fallback' || !comp.cid;

    tr.dataset.index = index;
    tr.className = `${isSelected ? 'bg-blue-50/60' : ''} hover:bg-blue-50`;

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
          <span data-edited-dot class="text-amber-500 text-xs ${comp.wasEdited ? '' : 'hidden'}" title="Manuell angepasst">●</span>
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
      <td class="text-right" data-field="mass">${formatNumber(comp.mass)}</td>
      <td class="text-right" data-field="moles">${formatNumber(comp.moles)}</td>
      <td class="text-right" data-field="equivalents">${comp.equivalents ? formatNumber(comp.equivalents) : '–'}</td>
      <td class="text-center">
        <div class="flex items-center justify-center gap-2">
          <span data-source-badge class="text-xs px-2 py-1 rounded-full border ${badgeClass}" title="${
            comp.wasEdited && comp.originalSource === 'pubchem'
              ? 'Aus PubChem geladen, dann manuell angepasst'
              : comp.source === 'pubchem'
                ? 'Automatisch aus PubChem übernommen'
                : comp.source === 'fallback'
                  ? 'Fallback-Daten'
                  : 'Manuell gepflegt'
          }">${sourceLabel}</span>
        </div>
      </td>
      <td class="text-center">
        <button class="text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-60"
          ${showPubchemButton ? '' : 'disabled'}
          onclick="triggerPubchemLookup(event, ${index})">
          PubChem
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDetail() {
  const panel = document.getElementById('detailPanel');
  if (!panel) return;
  const comp = state.selected === null ? null : state.components[state.selected];

  if (!comp) {
    panel.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-semibold text-slate-700">Detailansicht</h2>
          <p class="text-xs text-slate-500">Wählen Sie eine Stoffzeile aus, um Details zu sehen.</p>
        </div>
        <button class="px-3 py-2 rounded-lg bg-slate-200 text-slate-500 cursor-not-allowed" disabled>
          Keine Auswahl
        </button>
      </div>
      <div class="mt-3 text-sm text-slate-500">Noch keine Auswahl getroffen.</div>
    `;
    return;
  }

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

  const previewItems = [
    { label: 'CAS', value: comp.cas || detail.cas || '–' },
    { label: 'Formel', value: comp.formula || '–' },
    { label: 'CID', value: comp.cid || detail.cid || '–' },
    { label: 'SMILES', value: comp.smiles || detail.smiles || '–' },
    {
      label: 'Wikipedia',
      value:
        detail.wikipedia
          ? `<a class="text-blue-700 hover:underline" href="${detail.wikipedia}" target="_blank" rel="noreferrer">Wikipedia öffnen</a>`
          : '–'
    }
  ];

  const detailContent = `
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

  panel.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <h2 class="font-semibold text-slate-700">Detailansicht</h2>
        <p class="text-xs text-slate-500">Stoffdaten kompakt ein- oder ausklappbar.</p>
      </div>
      <button data-detail-toggle class="px-4 py-2 rounded-lg shadow-sm text-white transition-transform ${
        state.detailExpanded ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'
      }">
        ${state.detailExpanded ? 'Einklappen' : 'Details anzeigen'}
      </button>
    </div>
    <div class="mt-3 space-y-3">
      <div class="bg-gradient-to-r from-blue-50 to-slate-50 border border-blue-100 rounded-lg p-3">
        <div class="font-semibold text-lg text-slate-800">${comp.name}</div>
        <div class="grid sm:grid-cols-3 gap-2 mt-2 text-sm text-slate-600">
          ${previewItems
            .map(
              (item) =>
                `<div class="flex items-center gap-2"><span class="text-[11px] uppercase text-slate-400">${item.label}</span><span class="truncate">${item.value}</span></div>`
            )
            .join('')}
        </div>
      </div>
      <div data-collapsible class="collapsible-panel ${state.detailExpanded ? 'open' : 'closed'}">
        <div class="collapsible-inner">${detailContent}</div>
      </div>
    </div>
  `;

  const toggleBtn = panel.querySelector('[data-detail-toggle]');
  const collapsible = panel.querySelector('[data-collapsible]');
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      state.detailExpanded = !state.detailExpanded;
      renderDetail();
    };
  }

  if (collapsible) {
    const inner = collapsible.querySelector('.collapsible-inner');
    if (state.detailExpanded) {
      collapsible.style.maxHeight = `${inner.scrollHeight + 48}px`;
    } else {
      collapsible.style.maxHeight = '0px';
    }
  }
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
  state.detailExpanded = false;
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

  const tbody = document.getElementById('componentTable');
  if (tbody) {
    Array.from(tbody.querySelectorAll('tr')).forEach((rowEl) => {
      const rowIndex = Number(rowEl.dataset.index);
      const rowComp = state.components[rowIndex];
      if (!rowComp) return;

      const massCell = rowEl.querySelector('[data-field="mass"]');
      const molesCell = rowEl.querySelector('[data-field="moles"]');
      const eqCell = rowEl.querySelector('[data-field="equivalents"]');
      const sourceBadge = rowEl.querySelector('[data-source-badge]');
      const editedDot = rowEl.querySelector('[data-edited-dot]');

      if (editedDot && rowComp.wasEdited) {
        editedDot.classList.remove('hidden');
      }

      if (massCell) massCell.textContent = formatNumber(rowComp.mass);
      if (molesCell) molesCell.textContent = formatNumber(rowComp.moles);
      if (eqCell) eqCell.textContent = rowComp.equivalents ? formatNumber(rowComp.equivalents) : '–';
      if (sourceBadge) {
        const { badgeClass, label } = getSourceBadge(rowComp);
        sourceBadge.textContent = label;
        sourceBadge.className = `text-xs px-2 py-1 rounded-full border ${badgeClass}`;
      }
    });
  }

  renderDetail();
  renderSummary();
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

async function triggerPubchemLookup(event, index) {
  event.stopPropagation();
  const comp = state.components[index];
  if (!comp) return;

  const query = comp.cas || comp.name || comp.formula || comp.smiles;
  if (!query) {
    setStatus('Bitte Name, CAS oder Formel eintragen, um PubChem zu befragen.');
    return;
  }

  const btn = event.currentTarget;
  btn.disabled = true;
  btn.classList.add('opacity-70');
  setStatus('PubChem-Abfrage läuft ...');

  try {
    const response = await fetch('/api/pubchem-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`Serverfehler (${response.status})`);
    }

    const data = await response.json();
    if (data.compound) {
      Object.assign(comp, {
        cid: data.compound.cid || comp.cid,
        name: data.compound.name || comp.name,
        molecularWeight: data.compound.molecularWeight ?? comp.molecularWeight,
        formula: data.compound.formula || comp.formula,
        density: data.compound.density ?? comp.density,
        description: data.compound.description || comp.description,
        physicalProperties: data.compound.physicalProperties || comp.physicalProperties || {},
        pubchemDetails: data.compound.pubchemDetails || comp.pubchemDetails || {},
        smiles: data.compound.smiles || comp.smiles,
        source: 'pubchem',
        originalSource: 'pubchem',
        wasEdited: false
      });
      recomputeStoichiometry();
      render();
    }

    if (Array.isArray(data.trace) && data.trace.length) {
      state.debug.pubchemCalls.push(...data.trace);
      renderDebugDetails();
    }

    state.logs.push(`Manuelle PubChem-Abfrage für "${query}" abgeschlossen.`);
    renderLogs();
    setStatus('PubChem-Daten aktualisiert.');
  } catch (error) {
    setStatus(`PubChem-Fehler: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-70');
    setTimeout(() => setStatus(''), 2000);
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
  state.detailExpanded = false;
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
    state.detailExpanded = false;
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
window.triggerPubchemLookup = triggerPubchemLookup;

document.getElementById('primaryPrompt').value = state.prompts.primaryPrompt;
document.getElementById('retryPrompt').value = state.prompts.retryPrompt;
document.getElementById('analysisPrompt').value = state.analysis.prompt;

render();
