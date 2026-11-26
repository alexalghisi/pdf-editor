import assert from 'node:assert/strict';

import {
  SAMPLE_LINE,
  dropFile,
  multiPagePdf,
  newPage,
  openFile,
  sampleBytes,
  startApp,
} from './helpers.mjs';

const VIEWPORTS = [
  { width: 1280, height: 900, name: 'desktop' },
  { width: 390, height: 844, name: 'phone' },
];

async function blankPageTools(page) {
  await page.getByRole('button', { name: 'Start with a blank page' }).click();
  await page.getByText('Page 1 of 1', { exact: true }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'Next page' }).count(),
    0,
    'a single page has no pager',
  );

  const remove = page.getByRole('button', { name: 'Delete' });
  assert.equal(await remove.isDisabled(), true, 'nothing to delete yet');

  await page.getByRole('button', { name: 'Add text' }).click();
  const added = page.getByText('New text', { exact: true });
  await added.waitFor();

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByText('120%', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByText('80%', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Reset zoom' }).click();
  await page.getByText('100%', { exact: true }).waitFor();

  await added.click();
  assert.equal(await remove.isDisabled(), false, 'the text is selected');
  await remove.click();
  await added.waitFor({ state: 'detached' });
  assert.equal(await remove.isDisabled(), true, 'selection is cleared');

  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Open PDF' }).waitFor();
}

async function pageNavigation(page) {
  await openFile(page, await multiPagePdf(3));
  await page.getByText('Chapter 1', { exact: true }).waitFor();
  await page.getByText('Page 1 of 3', { exact: true }).waitFor();
  const previous = page.getByRole('button', { name: 'Previous page' });
  const next = page.getByRole('button', { name: 'Next page' });
  assert.equal(await previous.isDisabled(), true);

  await next.click();
  await page.getByText('Chapter 2', { exact: true }).waitFor();
  await next.click();
  await page.getByText('Chapter 3', { exact: true }).waitFor();
  await page.getByText('Page 3 of 3', { exact: true }).waitFor();
  assert.equal(await next.isDisabled(), true);

  await previous.click();
  await page.getByText('Chapter 2', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Open PDF' }).waitFor();
}

async function brokenFile(page) {
  await openFile(page, {
    name: 'broken.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('this is not a pdf'),
  });
  await page.getByRole('alert').waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'Open PDF' }).isVisible(),
    true,
    'a broken file keeps the start screen',
  );
}

async function dragAndDrop(page) {
  await dropFile(page, {
    name: 'notes.txt',
    type: 'text/plain',
    bytes: Buffer.from('not a pdf'),
  });
  assert.equal(
    await page.getByRole('button', { name: 'Open PDF' }).isVisible(),
    true,
    'other file types are ignored',
  );
  await dropFile(page, {
    name: 'agreement.pdf',
    type: 'application/pdf',
    bytes: sampleBytes(),
  });
  await page.getByText(SAMPLE_LINE, { exact: true }).waitFor();
  await page.getByText('agreement.pdf', { exact: true }).waitFor();
}

async function main() {
  const app = await startApp();
  const errors = [];
  try {
    for (const viewport of VIEWPORTS) {
      const page = await newPage(app, viewport, errors);
      await blankPageTools(page);
      await pageNavigation(page);
      await dragAndDrop(page);
      await page.context().close();

      const broken = await newPage(app, viewport, []);
      await brokenFile(broken);
      await broken.context().close();
      console.log(
        `✓ ${viewport.name}: add, zoom, delete, page navigation, drag and drop, broken file`,
      );
    }
    assert.deepEqual(errors, [], 'no console or page errors');
  } finally {
    await app.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
