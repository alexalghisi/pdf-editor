import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { PDFDocument, StandardFonts } from 'pdf-lib';
import { chromium } from 'playwright-core';

import { serveDist } from './server.mjs';

export const ROOT = resolve(import.meta.dirname, '..');
export const SAMPLE = join(ROOT, 'docs', 'sample-service-agreement.pdf');
export const SAMPLE_LINE = 'Client: Contoso Bakery Ltd.';

export async function startApp() {
  const server = await serveDist(join(ROOT, 'dist'));
  const executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(
    executablePath
      ? { executablePath, args: ['--no-sandbox'] }
      : { channel: 'chrome', args: ['--no-sandbox'] },
  );
  return {
    url: server.url,
    browser,
    async stop() {
      await browser.close();
      await server.close();
    },
  };
}

export async function newPage(app, viewport, errors) {
  const context = await app.browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    acceptDownloads: true,
    hasTouch: viewport.width < 600,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${viewport.name}: ${error}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`${viewport.name}: ${message.text()}`);
    }
  });
  await page.goto(app.url);
  await page.getByRole('button', { name: 'Open PDF' }).waitFor();
  return page;
}

export async function openFile(page, file) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Open PDF' }).click(),
  ]);
  await chooser.setFiles(file);
}

export async function dropFile(page, { name, type, bytes }) {
  await page.evaluate(
    ({ name, type, base64 }) => {
      const binary = atob(base64);
      const data = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([data], name, { type }));
      for (const kind of ['dragenter', 'dragover', 'drop']) {
        window.dispatchEvent(
          new DragEvent(kind, {
            dataTransfer: transfer,
            bubbles: true,
            cancelable: true,
          }),
        );
      }
    },
    { name, type, base64: Buffer.from(bytes).toString('base64') },
  );
}

export function sampleBytes() {
  return readFileSync(SAMPLE);
}

export async function multiPagePdf(pageCount) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 1; index <= pageCount; index += 1) {
    const page = pdf.addPage([612, 792]);
    page.drawText(`Chapter ${index}`, { x: 72, y: 700, size: 24, font });
  }
  return {
    name: 'chapters.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save()),
  };
}
