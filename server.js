import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeText } from './lib/analyzer.js';
import { runReactionAnalysis } from './lib/reactionAnalysis.js';
import { lookupManualComponent } from './lib/manualLookup.js';

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
    const component = req.body?.component;
    const prompts = req.body?.prompts || {};
    const reactionText = req.body?.reactionText || '';
    if (!component) {
      res.status(400).json({ error: 'Component required' });
      return;
    }
    const result = await lookupManualComponent(component, prompts, reactionText);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

app.use(express.static(__dirname));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`StochiPro läuft auf http://localhost:${port}`);
});
