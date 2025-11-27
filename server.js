import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeText } from './lib/analyzer.js';

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

app.use(express.static(__dirname));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`StochiPro läuft auf http://localhost:${port}`);
});
