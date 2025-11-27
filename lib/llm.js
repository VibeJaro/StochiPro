const DEFAULT_PRIMARY_PROMPT =
  'Du bist ein Chemie-Extraktionsagent. Extrahiere alle Chemikaliennamen oder CAS-Nummern aus dem Nutzereingabetext. Gib ausschließlich ein JSON-Array mit Strings zurück.';
const DEFAULT_RETRY_PROMPT =
  'Wir haben keine Treffer in PubChem gefunden. Finde eine alternative englische Schreibweise oder CAS-Nummer für die genannte Substanz. Antworte nur mit einem JSON-Array aus Strings.';
const OPENAI_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions';

function logMessage(logs, message) {
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

function parseCompoundList(content, logs) {
  if (!content) return [];
  try {
    const jsonStart = content.indexOf('[');
    const jsonEnd = content.lastIndexOf(']');
    const slice = jsonStart !== -1 && jsonEnd !== -1 ? content.slice(jsonStart, jsonEnd + 1) : content;
    const parsed = JSON.parse(slice);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => String(entry).trim()).filter(Boolean);
    }
  } catch (error) {
    logMessage(logs, `Konnte LLM-Antwort nicht parsen: ${error.message}`);
  }
  return [];
}

async function extractCompoundsFromLLM(text, prompt, logs) {
  const content = await callLLM(
    prompt || DEFAULT_PRIMARY_PROMPT,
    `Extrahiere alle Chemikaliennamen oder CAS-Nummern aus diesem Text. Antworte nur mit JSON-Array: \n${text}`,
    'Primär-Extraktion',
    logs
  );

  return {
    compounds: parseCompoundList(content, logs),
    raw: content
  };
}

async function retryCompoundName(originalName, text, prompt, logs) {
  const content = await callLLM(
    prompt || DEFAULT_RETRY_PROMPT,
    `Der Stoff "${originalName}" konnte nicht auf PubChem gefunden werden. Bitte liefere eine englische Schreibweise oder CAS-Nummer als JSON-Array. Text-Kontext: ${text}`,
    'Fallback-Extraktion',
    logs
  );
  const list = parseCompoundList(content, logs);
  return list[0] || null;
}

export {
  DEFAULT_PRIMARY_PROMPT,
  DEFAULT_RETRY_PROMPT,
  extractCompoundsFromLLM,
  parseCompoundList,
  retryCompoundName
};
