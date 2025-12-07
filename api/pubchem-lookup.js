import { searchCompound } from '../lib/pubchem.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const query = body?.query?.trim();
    if (!query) {
      res.status(400).json({ error: 'Query required' });
      return;
    }

    const trace = [];
    const compound = await searchCompound(query, trace);
    if (!compound) {
      res.status(404).json({ error: 'Kein PubChem-Treffer gefunden', trace });
      return;
    }

    res.status(200).json({ compound, trace });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
}
