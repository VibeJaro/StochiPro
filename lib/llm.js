const DEFAULT_PRIMARY_PROMPT = `
Du bist ein Chemie-Extraktionsagent für Stöchiometrie.
Extrahiere aus dem Nutzereingabetext alle Stoffe inklusive Menge, Einheit und Rolle.

Antworte ausschließlich mit einem JSON-Array von Objekten. Jedes Objekt besitzt:
  - name: String, gebräuchlicher Name
  - cas: optionale CAS-Nummer als String (nur falls ausdrücklich im Text genannt)
  - quantity: optionale Zahl (verwende Dezimalpunkt)
  - unit: optionales Kürzel (g, mg, ml, mmol, mol)
  - role: edukt | produkt | lösemittel | additiv | katalysator (andere Rollen sind nicht erlaubt)
  - coefficient: optionaler stöchiometrischer Koeffizient (Standard 1)

WICHTIG:
- Trage keine Werte ein, die nicht im Text stehen (keine erfundenen CAS-Nummern, Mengen oder Rollen).
- Nutze nur die genannten Rollen; wenn keine Rolle genannt ist, schätze nicht, sondern verwende den neutralen Default "edukt".

Beispiel: [
  {"name":"ethanol","quantity":4,"unit":"g","role":"edukt"},
  {"name":"acetic acid","quantity":8,"unit":"g","role":"edukt"},
  {"name":"ethyl acetate","role":"produkt"}
]`;
const DEFAULT_RETRY_PROMPT =
  'Wir haben keine Treffer in PubChem gefunden. Nutze den Kontext des fehlgeschlagenen Versuchs, um NUR für die fehlenden Stoffe eine alternative englische Schreibweise oder CAS-Nummer zu liefern. Antworte ausschließlich mit einem JSON-Array aus Strings.';
const OPENAI_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions';

function logMessage(logs, message) {
  if (typeof logs === 'function') {
    logs(message);
    return;
  }
  if (logs) logs.push(message);
}

async function callLLM(prompt, userMessage, tag, logs) {
  if (!process.env.OPENAI_API_KEY) {
    logMessage(logs, 'OpenAI Key fehlt – LLM-Schritt übersprungen.');
    return null;
  }

  try {
    logMessage(logs, `LLM (${tag}) wird aufgerufen.`);
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5.1',
        temperature: 0,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userMessage }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI HTTP ${response.status}: ${text}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    logMessage(logs, `LLM (${tag}) Antwort: ${content || '[leer]'}`);
    return content;
  } catch (error) {
    logMessage(logs, `LLM (${tag}) Fehler: ${error.message}`);
    return null;
  }
}

function parseComponentList(content, logs) {
  if (!content) return [];
  try {
    const jsonStart = content.indexOf('[');
    const jsonEnd = content.lastIndexOf(']');
    const slice = jsonStart !== -1 && jsonEnd !== -1 ? content.slice(jsonStart, jsonEnd + 1) : content;
    const parsed = JSON.parse(slice);
    if (Array.isArray(parsed)) {
      const normalized = parsed
        .map((entry) => {
          if (!entry) return null;
          if (typeof entry === 'string') {
            return { name: entry.trim(), role: 'reactant' };
          }
          if (typeof entry === 'object') {
            const name = entry.name || entry.cas;
            if (!name) return null;
            return {
              name: String(name).trim(),
              cas: entry.cas ? String(entry.cas).trim() : undefined,
              quantity: entry.quantity !== undefined ? Number(entry.quantity) : null,
              unit: entry.unit ? String(entry.unit).trim() : null,
              role: entry.role ? String(entry.role).toLowerCase() : 'reactant',
              coefficient:
                entry.coefficient !== undefined && entry.coefficient !== null
                  ? Number(entry.coefficient)
                  : 1,
              aliases: Array.isArray(entry.aliases)
                ? entry.aliases.map((a) => String(a).trim()).filter(Boolean)
                : undefined
            };
          }
          return null;
        })
        .filter(Boolean);
      logMessage(
        logs,
        `LLM-Antwort geparst: ${
          normalized.length
            ? normalized.map((c) => c.name).join(', ')
            : 'keine Treffer'
        }.`
      );
      return normalized;
    }
  } catch (error) {
    logMessage(logs, `Konnte LLM-Antwort nicht parsen: ${error.message}`);
  }
  return [];
}

async function extractComponentsFromLLM(text, prompt, logs) {
  const content = await callLLM(
    prompt || DEFAULT_PRIMARY_PROMPT,
    `Extrahiere alle Chemikalien, Mengen, Einheiten und Rollen aus diesem Text. Antworte nur mit JSON-Array: \n${text}`,
    'Primär-Extraktion',
    logs
  );

  return {
    components: parseComponentList(content, logs),
    raw: content
  };
}

async function retryCompoundName(originalName, text, prompt, logs, context = {}) {
  const { extractionContext, attemptedNames = [], knownComponents = [] } = context;
  const lines = [
    `Der Stoff "${originalName}" konnte nicht auf PubChem gefunden werden.`,
    attemptedNames.length
      ? `Bereits ausprobierte Schreibweisen/CAS: ${attemptedNames.join(', ')}.`
      : null,
    knownComponents.length
      ? `Diese Komponenten wurden bereits erkannt und benötigen KEINE erneute Suche: ${knownComponents.join(', ')}.`
      : null,
    extractionContext ? `Erste LLM-Extraktion (Rohdaten): ${extractionContext}` : null,
    `Nutzertext: ${text}`
  ]
    .filter(Boolean)
    .join('\n');

  const content = await callLLM(
    prompt || DEFAULT_RETRY_PROMPT,
    lines,
    'Fallback-Extraktion',
    logs
  );
  const list = parseComponentList(content, logs).map((c) => c.name || c.cas).filter(Boolean);
  const candidate = list[0] || null;
  logMessage(logs, candidate
    ? `LLM-Fallback liefert neuen Kandidaten: ${candidate}.`
    : 'LLM-Fallback lieferte keinen neuen Kandidaten.');
  return candidate;
}

export {
  DEFAULT_PRIMARY_PROMPT,
  DEFAULT_RETRY_PROMPT,
  extractComponentsFromLLM,
  parseComponentList,
  retryCompoundName
};
