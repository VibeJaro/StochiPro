import { runReactionAnalysis } from '../lib/reactionAnalysis.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const components = body?.components || [];
    const prompt = body?.prompt;
    const reactionText = body?.reactionText;

    const result = await runReactionAnalysis(components, prompt, reactionText);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
}
