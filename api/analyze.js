import { analyzeText } from '../lib/analyzer.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const text = body?.text || '';
    const prompts = body?.prompts || {};
    if (!text.trim()) {
      res.status(400).json({ error: 'Text required' });
      return;
    }
    const result = await analyzeText(text, prompts);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
}
