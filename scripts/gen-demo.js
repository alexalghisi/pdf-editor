const fs = require('fs');
const path = require('path');

const W = 480;
const H = 270;
const DELAY = 90;

const C = {
  ink: [14, 17, 22],
  paper: [246, 241, 231],
  gold: [201, 162, 39],
  text: [232, 237, 242],
  mute: [139, 148, 158],
  raised: [31, 38, 48],
  line: [48, 54, 61],
  dark: [14, 17, 22],
};

const PALETTE = [
  C.ink,
  C.paper,
  C.gold,
  C.text,
  C.mute,
  C.raised,
  C.line,
  C.dark,
];

const GLYPHS = {
  ' ': [0, 0, 0, 0, 0, 0, 0],
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0e],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x1f],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0e, 0x11, 0x10, 0x0e, 0x01, 0x11, 0x0e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x0a, 0x0a, 0x04],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04],
  '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  '+': [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
};

function drawChar(px, x, y, ch, color, scale) {
  const rows = GLYPHS[ch] ?? GLYPHS[' '];
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (rows[row] & (1 << (4 - col))) {
        fill(px, x + col * scale, y + row * scale, scale, scale, color);
      }
    }
  }
}

function createFrame() {
  const pixels = Buffer.alloc(W * H);
  return pixels;
}

function idx(x, y) {
  return y * W + x;
}

function fill(px, x, y, w, h, color) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) {
      px[idx(xx, yy)] = color;
    }
  }
}

function fillRound(px, x, y, w, h, r, color) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) {
      const dx =
        xx < x + r ? x + r - xx : xx >= x + w - r ? xx - (x + w - 1 - r) : 0;
      const dy =
        yy < y + r ? y + r - yy : yy >= y + h - r ? yy - (y + h - 1 - r) : 0;
      if (dx * dx + dy * dy <= r * r + r) {
        px[idx(xx, yy)] = color;
      }
    }
  }
}

function drawText(px, x, y, text, color, scale) {
  const step = 6 * scale;
  for (let i = 0; i < text.length; i += 1) {
    drawChar(px, x + i * step, y, text[i], color, scale);
  }
}

function textWidth(text, scale) {
  return text.length * 6 * scale - scale;
}

function centerText(px, y, text, color, scale) {
  drawText(
    px,
    Math.floor((W - textWidth(text, scale)) / 2),
    y,
    text,
    color,
    scale,
  );
}

function home() {
  const px = createFrame();
  fill(px, 0, 0, W, H, 0);
  centerText(px, 28, 'PDF EDITOR', 3, 3);
  centerText(px, 78, 'LOAD. EDIT. SAVE.', 4, 2);
  fillRound(px, 70, 130, 340, 36, 18, 2);
  centerText(px, 140, 'OPEN PDF', 0, 2);
  fillRound(px, 70, 180, 340, 36, 18, 5);
  centerText(px, 190, 'BLANK PAGE', 3, 2);
  centerText(px, 246, 'A. ALGHISI', 4, 1);
  return px;
}

function editor(withText) {
  const px = createFrame();
  fill(px, 0, 0, W, H, 0);
  fill(px, 0, 0, W, 28, 5);
  drawText(px, 12, 8, 'CLOSE', 4, 1);
  centerText(px, 8, 'UNTITLED.PDF', 3, 1);
  drawText(px, W - 46, 8, 'SAVE', 2, 1);
  fill(px, 92, 36, 296, 188, 1);
  fill(px, 92, 36, 296, 1, 6);
  fill(px, 92, 223, 296, 1, 6);
  fill(px, 92, 36, 1, 188, 6);
  fill(px, 387, 36, 1, 188, 6);
  if (withText) {
    fill(px, 124, 72, 92, 28, 1);
    fill(px, 124, 72, 92, 1, 2);
    fill(px, 124, 99, 92, 1, 2);
    fill(px, 124, 72, 1, 28, 2);
    fill(px, 215, 72, 1, 28, 2);
    drawText(px, 132, 80, 'HELLO', 0, 2);
  }
  fill(px, 0, 232, W, 38, 5);
  const tools = ['TEXT', 'IMAGE', 'DEL', '-', '+'];
  let tx = 28;
  for (let i = 0; i < tools.length; i += 1) {
    fillRound(
      px,
      tx - 4,
      240,
      textWidth(tools[i], 1) + 10,
      18,
      8,
      i === 0 && withText ? 2 : 0,
    );
    drawText(px, tx, 244, tools[i], i === 0 && withText ? 0 : 3, 1);
    tx += textWidth(tools[i], 1) + 28;
  }
  return px;
}

function gifBlock(bytes) {
  const chunks = [];
  let offset = 0;
  while (offset < bytes.length) {
    const size = Math.min(255, bytes.length - offset);
    chunks.push(Buffer.from([size]));
    chunks.push(bytes.subarray(offset, offset + size));
    offset += size;
  }
  chunks.push(Buffer.from([0]));
  return Buffer.concat(chunks);
}

function encodeFrame(pixels) {
  const clear = 8;
  const eoi = 9;
  const codes = [];
  codes.push(clear);
  for (let i = 0; i < pixels.length; i += 1) {
    codes.push(pixels[i] & 7);
    if ((i + 1) % 120 === 0) {
      codes.push(clear);
    }
  }
  codes.push(eoi);

  const out = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < codes.length; i += 1) {
    acc |= codes[i] << bits;
    bits += 4;
    while (bits >= 8) {
      out.push(acc & 255);
      acc >>= 8;
      bits -= 8;
    }
  }
  if (bits > 0) {
    out.push(acc & 255);
  }
  return Buffer.concat([Buffer.from([3]), gifBlock(Buffer.from(out))]);
}

function graphicControl() {
  return Buffer.from([0x21, 0xf9, 0x04, 0x08, DELAY & 255, DELAY >> 8, 0, 0]);
}

function imageDescriptor() {
  const buf = Buffer.alloc(10);
  buf[0] = 0x2c;
  buf.writeUInt16LE(W, 5);
  buf.writeUInt16LE(H, 7);
  return buf;
}

function buildGif(frames) {
  const header = Buffer.from('GIF89a', 'ascii');
  const screen = Buffer.alloc(7);
  screen.writeUInt16LE(W, 0);
  screen.writeUInt16LE(H, 2);
  screen[4] = 0x80 | 0x70 | 2;
  screen[5] = 0;
  screen[6] = 0;
  const table = Buffer.alloc(24);
  for (let i = 0; i < PALETTE.length; i += 1) {
    table[i * 3] = PALETTE[i][0];
    table[i * 3 + 1] = PALETTE[i][1];
    table[i * 3 + 2] = PALETTE[i][2];
  }
  const loop = Buffer.from([
    0x21,
    0xff,
    0x0b,
    ...Buffer.from('NETSCAPE2.0'),
    0x03,
    0x01,
    0,
    0,
    0,
  ]);
  const parts = [header, screen, table, loop];
  for (let i = 0; i < frames.length; i += 1) {
    parts.push(graphicControl());
    parts.push(imageDescriptor());
    parts.push(encodeFrame(frames[i]));
  }
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}

const out = path.join(__dirname, '..', 'assets', 'demo.gif');
fs.writeFileSync(out, buildGif([home(), editor(false), editor(true)]));
process.stdout.write(out + '\n');
