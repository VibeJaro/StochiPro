import { analyzeReaction } from '../lib/workflow.js';

export default async function handler(req, res) {
  if (req.method && req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Nur POST erlaubt' }));
    return;
  }

  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  let payload = {};
  try {
    payload = body ? JSON.parse(body) : {};
  } catch (err) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Ungültiges JSON' }));
    return;
  }

  const { input } = payload;
  if (!input || typeof input !== 'string') {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'input fehlt' }));
    return;
  }

  try {
    const result = await analyzeReaction(input);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
}
