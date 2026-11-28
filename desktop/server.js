const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const BASE_PATH = '/pdf-editor';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveFile(root, requestUrl) {
  const pathname = decodeURIComponent(
    new URL(requestUrl, 'http://127.0.0.1').pathname,
  );
  if (pathname !== BASE_PATH && !pathname.startsWith(`${BASE_PATH}/`)) {
    return null;
  }
  const relative = pathname.slice(BASE_PATH.length).replace(/^\/+/, '');
  const absoluteRoot = path.resolve(root);
  const candidate = path.resolve(absoluteRoot, relative);
  if (
    candidate !== absoluteRoot &&
    !candidate.startsWith(absoluteRoot + path.sep)
  ) {
    return null;
  }
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }
  if (path.extname(candidate) === '') {
    return path.join(absoluteRoot, 'index.html');
  }
  return null;
}

function startServer(root) {
  const server = http.createServer((request, response) => {
    let file = null;
    try {
      file = resolveFile(root, request.url ?? '/');
    } catch {
      file = null;
    }
    if (!file || !fs.existsSync(file)) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type':
        MIME_TYPES[path.extname(file).toLowerCase()] ??
        'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}${BASE_PATH}/` });
    });
  });
}

module.exports = { BASE_PATH, resolveFile, startServer };
