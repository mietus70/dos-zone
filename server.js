#!/usr/bin/env node
/**
 * Prosty serwer statyczny do lokalnego uruchamiania DOS Zone.
 *
 * Serwituje pliki z katalogu projektu bez zmian — dokładnie tak, jak
 * będzie wyglądać strona na serwerze produkcyjnym (emulator pobiera
 * pliki js/wdosbox.js, js/wdosbox.wasm.js, exe/*.zip, sfx/* w trakcie
 * pracy, więc zwykły serwer statyczny to wystarczające i poprawne
 * środowisko deweloperskie).
 *
 * Użycie:  node server.js [--port 8080]   (lub zmienne środowiskowa PORT)
 * Zależności: żadne (tylko Node.js).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const PORT = parseInt(portIdx !== -1 ? args[portIdx + 1] : (process.env.PORT || '8080'), 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.zip': 'application/zip',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({ 'Cache-Control': 'no-cache' }, headers));
  res.end(body);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    return send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain' });
  }
  if (pathname === '/') pathname = '/index.html';

  // Normalizacja + ochrona przed wyjściem poza katalog projektu (path traversal)
  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Czytelny 404 — ważne, żeby NIE odsyłać index.html, bo wtedy
      // np. fetch("js/wdosbox.wasm.js") dostałby HTML zamiast binarki.
      return send(res, 404, 'Nie znaleziono pliku: ' + pathname, { 'Content-Type': 'text/plain; charset=utf-8' });
    }

    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
    });

    if (req.method === 'HEAD') return res.end();

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      try { res.destroy(); } catch (e) { /* ignore */ }
    });
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('DOS Zone — serwer statyczny: http://localhost:' + PORT + '/  (katalog: ' + ROOT + ')');
  console.log('Ctrl+C — zatrzymaj serwer.');
});
