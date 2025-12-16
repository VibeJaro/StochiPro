import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeText } from './lib/analyzer.js';
import { runReactionAnalysis } from './lib/reactionAnalysis.js';
import { searchCompound } from './lib/pubchem.js';

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.post('/api/analyze', async (req, res) => {
  try {
    const text = req.body?.text || '';
    const prompts = req.body?.prompts || {};
    if (!text.trim()) {
      res.status(400).json({ error: 'Text required' });
      return;
    }
    const result = await analyzeText(text, prompts);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

app.post('/api/reaction-analysis', async (req, res) => {
  try {
    const components = req.body?.components || [];
    const prompt = req.body?.prompt;
    const reactionText = req.body?.reactionText;
    const result = await runReactionAnalysis(components, prompt, reactionText);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

app.post('/api/pubchem-lookup', async (req, res) => {
  try {
    const query = req.body?.query?.trim();
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

    res.json({ compound, trace });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

app.use(express.static(__dirname));

const port = process.env.PORT || 3000;
const host = '0.0.0.0';
app.listen(port, host, () => {
  console.log(`StochiPro läuft auf http://${host}:${port}`);
});
