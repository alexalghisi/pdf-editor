// End-to-end: opens a Chrome-printed PDF in the built web app, edits its text
// like a document (overwrite a line, replace one word, Escape to cancel),
// then saves as PDF, Word and CSV and checks what was written.
//
//   npm run build:web && npm run e2e
//
// Uses the system Chrome (CHROME_PATH, or the "chrome" channel).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { strFromU8, unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { chromium } from 'playwright-core';

import { serveDist } from './server.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const SAMPLE = join(ROOT, 'docs', 'sample-service-agreement.pdf');

function launchOptions() {
  const executablePath = process.env.CHROME_PATH;
  return executablePath
    ? { executablePath, args: ['--no-sandbox'] }
    : { channel: 'chrome', args: ['--no-sandbox'] };
}

async function editLine(page, current, apply) {
  const line = page.getByText(current, { exact: true });
  await line.click();
  await line.click();
  const input = page.getByLabel('Edit text');
  await input.waitFor();
  assert.equal(await input.inputValue(), current, 'editor opens with the line');
  await apply(input);
}

async function waitForText(page, text) {
  await page.getByText(text, { exact: true }).waitFor({ timeout: 15000 });
}

async function saveAs(page, label, folder) {
  await page.getByRole('button', { name: 'Save as…' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText(label, { exact: true }).click(),
  ]);
  const path = join(folder, download.suggestedFilename());
  await download.saveAs(path);
  await page.getByText(label, { exact: true }).waitFor({ state: 'hidden' });
  return path;
}

/** The text a saved PDF draws on page 1, as pdf.js extracts it. */
async function pdfText(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: false })
    .promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  return content.items.map((item) => item.str).join(' ');
}

async function main() {
  const server = await serveDist(join(ROOT, 'dist'));
  const browser = await chromium.launch(launchOptions());
  const errors = [];
  try {
    for (const viewport of [
      { width: 1280, height: 900, name: 'desktop' },
      { width: 390, height: 844, name: 'phone' },
    ]) {
      const context = await browser.newContext({
        viewport,
        acceptDownloads: true,
        hasTouch: viewport.name === 'phone',
      });
      const page = await context.newPage();
      page.on('pageerror', (error) =>
        errors.push(`${viewport.name}: ${error}`),
      );
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(`${viewport.name}: ${message.text()}`);
        }
      });

      await page.goto(server.url);
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByText('Open PDF').click(),
      ]);
      await chooser.setFiles(SAMPLE);
      await waitForText(page, 'Client: Contoso Bakery Ltd.');

      // Overwrite a whole line: the editor opens with it selected.
      await editLine(page, 'Client: Contoso Bakery Ltd.', async (input) => {
        await input.pressSequentially('Client: Gilău Pastry House SRL');
        await input.press('Enter');
      });
      await waitForText(page, 'Client: Gilău Pastry House SRL');

      // Replace one word inside a sentence, keeping the rest.
      const sentence =
        'Delivery is planned within six weeks of the signed agreement.';
      await editLine(page, sentence, async (input) => {
        await input.press('Home');
        for (let i = 0; i < 'Delivery is planned within '.length; i += 1) {
          await input.press('ArrowRight');
        }
        await input.press('Shift+ArrowRight');
        await input.press('Shift+ArrowRight');
        await input.press('Shift+ArrowRight');
        await input.pressSequentially('four');
        await input.press('Enter');
      });
      await waitForText(
        page,
        'Delivery is planned within four weeks of the signed agreement.',
      );

      // Escape leaves the line as it was.
      await editLine(page, 'Total: 4,240 EUR', async (input) => {
        await input.pressSequentially('nothing');
        await input.press('Escape');
      });
      await waitForText(page, 'Total: 4,240 EUR');

      const folder = await mkdtemp(join(tmpdir(), `pdf-e2e-${viewport.name}-`));
      const pdfPath = await saveAs(page, 'PDF document (.pdf)', folder);
      const pdfBytes = new Uint8Array(readFileSync(pdfPath));
      await PDFDocument.load(pdfBytes);
      const drawn = await pdfText(pdfBytes);
      assert.match(drawn, /Gilău Pastry House SRL/);
      assert.match(drawn, /within four weeks/);
      assert.match(drawn, /Total: 4,240 EUR/);
      assert.doesNotMatch(drawn, /Contoso Bakery/);

      const docxPath = await saveAs(page, 'Word document (.docx)', folder);
      const docx = unzipSync(new Uint8Array(readFileSync(docxPath)));
      const body = strFromU8(docx['word/document.xml']);
      assert.match(body, /Gilău Pastry House SRL/);

      const csvPath = await saveAs(page, 'Spreadsheet (.csv)', folder);
      const csv = readFileSync(csvPath, 'utf8');
      assert.match(csv, /Website design,"2,400 EUR"/);

      console.log(
        `✓ ${viewport.name}: edit, word replace, escape, save as PDF/Word/CSV`,
      );
      await context.close();
    }
    assert.deepEqual(errors, [], 'no console or page errors');
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
