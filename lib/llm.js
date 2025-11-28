const DEFAULT_PRIMARY_PROMPT = `
Du bist ein Chemie-Extraktionsagent für Stöchiometrie.
Extrahiere aus dem Nutzereingabetext alle Stoffe inklusive Menge, Einheit und Rolle.

Erlaubte Rollen sind ausschließlich: "Edukt", "Produkt", "Lösemittel", "Additiv", "Katalysator".
Trage nur Werte ein, die explizit im Text erwähnt sind (keine CAS-Nummern, Mengen oder Rollen erfinden).

Antworte ausschließlich mit einem JSON-Array von Objekten. Jedes Objekt besitzt:
  - name: String, gebräuchlicher Name
  - cas: optionale CAS-Nummer als String (nur wenn im Text genannt)
  - quantity: optionale Zahl (verwende Dezimalpunkt)
  - unit: optionales Kürzel (g, mg, ml, mmol, mol)
  - role: Edukt | Produkt | Lösemittel | Additiv | Katalysator
  - coefficient: optionaler stöchiometrischer Koeffizient (Standard 1)
  - aliases: optionale Liste alternativer im Text genannter Namen

Beispiel: [
  {"name":"Ethanol","quantity":4,"unit":"g","role":"Edukt"},
  {"name":"Essigsäureanhydrid","quantity":8,"unit":"g","role":"Edukt"},
  {"name":"Aspirin","role":"Produkt"}
]`;
const DEFAULT_RETRY_PROMPT =
  'Wir haben keine Treffer in PubChem gefunden. Nutze den Kontext zum fehlgeschlagenen Versuch, um nur die fehlenden oder unklaren Stoffe zu präzisieren. Antworte ausschließlich mit einem JSON-Array aus Strings (alternative Schreibweisen oder CAS-Nummern). Verwende den Kontext aus der ersten Anfrage, um keine bereits gefundenen Stoffe zu wiederholen.';
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

  const normalizeRole = (role) => {
    const value = (role || '').toString().trim().toLowerCase();
    if (!value) return 'edukt';
    if (['reactant', 'edukt', 'educt'].includes(value)) return 'edukt';
    if (['product', 'produkt'].includes(value)) return 'produkt';
    if (['solvent', 'lösemittel', 'loesemittel'].includes(value)) return 'lösemittel';
    if (['additive', 'additiv'].includes(value)) return 'additiv';
    if (['catalyst', 'katalysator'].includes(value)) return 'katalysator';
    return value;
  };

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
              role: normalizeRole(entry.role),
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
  const contextLines = [];
  if (context.attempts && context.attempts.length) {
    const attemptSummary = context.attempts
      .map((a) => `${a.name}: ${a.result}`)
      .join('; ');
    contextLines.push(`Bisherige PubChem-Versuche: ${attemptSummary}`);
  }
  if (context.extraction) {
    contextLines.push(`Erster Extraktions-Output: ${context.extraction}`);
  }

  const contextText = contextLines.length ? `\n${contextLines.join('\n')}` : '';

  const content = await callLLM(
    prompt || DEFAULT_RETRY_PROMPT,
    `Der Stoff "${originalName}" konnte nicht auf PubChem gefunden werden. Bitte liefere eine englische Schreibweise oder CAS-Nummer als JSON-Array. Text-Kontext: ${text}${contextText}`,
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
