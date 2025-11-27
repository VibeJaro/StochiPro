import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import handler from './api/analyze.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const port = process.env.PORT || 3000;
const staticFiles = ['index.html', 'app.js', 'styles.css'];

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/analyze') {
    await handler(req, res);
    return;
  }

  const requested = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(__dirname, requested.split('?')[0]);
  if (staticFiles.some((f) => requested.startsWith(`/${f}`))) {
    fs.createReadStream(filePath)
      .on('error', () => {
        res.writeHead(404);
        res.end('Not found');
      })
      .pipe(res);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(port, () => {
  console.log(`Dev-Server läuft auf http://localhost:${port}`);
});
