import crypto from 'node:crypto';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export async function extractComponentsWithLLM(input) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const system = `Du bist ein Chemie-Assistent. Extrahiere aus freiem Text die Reaktionskomponenten und gib JSON zurück mit\n[{id, name, role: "Edukt"|"Produkt", coefficient, amount:{value, unit}}]. Lasse Einheiten unverändert. Vermeide Fließtext.`;
  const user = `Text: ${input}`;

  const resp = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LLM-Extraktion fehlgeschlagen: ${text}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return null;
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.components)) return parsed.components;
  return null;
}

export function ensureIds(components = []) {
  return components.map((c) => ({
    ...c,
    id: c.id || crypto.randomUUID(),
    logs: c.logs || [],
  }));
}
