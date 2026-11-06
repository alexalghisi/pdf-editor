// Serves ./dist under /pdf-editor/, the GitHub Pages base path from app.json.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
};

export function serveDist(root, port = 0) {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const relative = url.pathname.replace(/^\/pdf-editor/, '') || '/';
    let file = normalize(join(root, decodeURIComponent(relative)));
    if (
      !file.startsWith(root) ||
      !existsSync(file) ||
      statSync(file).isDirectory()
    ) {
      file = join(root, 'index.html');
    }
    response.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}/pdf-editor/`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}
