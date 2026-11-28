import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveFile, startServer } = require('../server.js');

let root;
let running;

before(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-editor-desktop-'));
  fs.mkdirSync(path.join(root, '_expo', 'static'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><p>app</p>');
  fs.writeFileSync(path.join(root, '_expo', 'static', 'app.js'), 'let a = 1;');
  fs.writeFileSync(path.join(root, 'pdf.worker.min.mjs'), 'export {};');
  running = await startServer(root);
});

after(() => {
  running.server.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('serves the app shell under the base path', async () => {
  const response = await fetch(running.url);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(await response.text(), /app/);
});

test('serves scripts and the pdf worker as JavaScript', async () => {
  const script = await fetch(new URL('_expo/static/app.js', running.url));
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /text\/javascript/);
  const worker = await fetch(new URL('pdf.worker.min.mjs', running.url));
  assert.match(worker.headers.get('content-type'), /text\/javascript/);
});

test('falls back to the app shell for client routes', () => {
  assert.equal(
    resolveFile(root, '/pdf-editor/editor'),
    path.join(root, 'index.html'),
  );
});

test('answers 404 for missing assets and paths outside the base', async () => {
  const missing = await fetch(new URL('missing.js', running.url));
  assert.equal(missing.status, 404);
  const outside = await fetch(new URL('/other', running.url));
  assert.equal(outside.status, 404);
});

test('never resolves a file outside the web root', () => {
  assert.equal(resolveFile(root, '/pdf-editor/%2e%2e/%2e%2e/etc/passwd'), null);
  assert.equal(resolveFile(root, '/pdf-editor/..%2f..%2fsecret.js'), null);
});
