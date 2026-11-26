import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  ROOT,
  SAMPLE,
  SAMPLE_LINE,
  newPage,
  openFile,
  startApp,
} from './helpers.mjs';

const SHOTS = join(ROOT, 'e2e-screenshots');
const MIN_TARGET = 44;

const VIEWPORTS = [
  { width: 320, height: 568, name: 'phone-small' },
  { width: 390, height: 844, name: 'phone' },
  { width: 844, height: 390, name: 'phone-landscape' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 1280, height: 800, name: 'laptop' },
  { width: 1920, height: 1080, name: 'desktop' },
];

const HOME_BUTTONS = ['Open PDF', 'Start with a blank page'];
const EDITOR_BUTTONS = [
  'Close',
  'Save as…',
  'Add text',
  'Add image',
  'Delete',
  'Zoom out',
  'Reset zoom',
  'Zoom in',
];
const SHEET_BUTTONS = [
  'Save as PDF document (.pdf)',
  'Save as Word document (.docx)',
  'Save as Web page (.html)',
  'Save as Spreadsheet (.csv)',
  'Save as Plain text (.txt)',
  'Cancel',
];

function overlaps(a, b) {
  return (
    a.x < b.x + b.width - 0.5 &&
    b.x < a.x + a.width - 0.5 &&
    a.y < b.y + b.height - 0.5 &&
    b.y < a.y + a.height - 0.5
  );
}

async function assertLayout(page, viewport, screen, names) {
  const where = `${viewport.name} ${screen}`;
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  assert.ok(overflow <= 0, `${where}: page scrolls sideways by ${overflow}px`);

  for (const name of names) {
    const button = page.getByRole('button', { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    assert.ok(box, `${where}: "${name}" is not rendered`);
    assert.ok(
      box.x >= 0 && box.x + box.width <= viewport.width + 0.5,
      `${where}: "${name}" is cut off horizontally`,
    );
    assert.ok(
      box.y >= 0 && box.y + box.height <= viewport.height + 0.5,
      `${where}: "${name}" is cut off vertically`,
    );
    assert.ok(
      box.width >= MIN_TARGET && box.height >= MIN_TARGET,
      `${where}: "${name}" is ${box.width}×${box.height}, below ${MIN_TARGET}px`,
    );
  }
  const boxes = [];
  for (const name of names) {
    const box = await page
      .getByRole('button', { name, exact: true })
      .boundingBox();
    boxes.push({ name, box });
  }
  for (const [index, first] of boxes.entries()) {
    for (const second of boxes.slice(index + 1)) {
      assert.ok(
        !overlaps(first.box, second.box),
        `${where}: "${first.name}" overlaps "${second.name}"`,
      );
    }
  }
  await page.screenshot({
    path: join(SHOTS, `${viewport.name}-${screen}.png`),
  });
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const app = await startApp();
  const errors = [];
  try {
    for (const viewport of VIEWPORTS) {
      const page = await newPage(app, viewport, errors);
      await assertLayout(page, viewport, 'home', HOME_BUTTONS);

      await openFile(page, SAMPLE);
      const line = page.getByText(SAMPLE_LINE, { exact: true });
      await line.waitFor();
      await page.getByLabel('Rendering page').waitFor({ state: 'detached' });
      const lineBox = await line.boundingBox();
      assert.ok(
        lineBox.x >= 0 && lineBox.x + lineBox.width <= viewport.width,
        `${viewport.name}: the page does not fit the screen width`,
      );
      await assertLayout(page, viewport, 'editor', EDITOR_BUTTONS);

      await page.getByRole('button', { name: 'Save as…' }).click();
      await page.getByRole('button', { name: 'Cancel' }).waitFor();
      await assertLayout(page, viewport, 'save-as', SHEET_BUTTONS);
      await page.getByRole('button', { name: 'Cancel' }).click();

      console.log(
        `✓ ${viewport.name} ${viewport.width}×${viewport.height}: no overflow, controls visible, tappable and not overlapping`,
      );
      await page.context().close();
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
