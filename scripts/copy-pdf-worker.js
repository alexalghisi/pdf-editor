const fs = require('fs');
const path = require('path');

const source = require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
const target = path.join(__dirname, '..', 'public', 'pdf.worker.min.mjs');

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
