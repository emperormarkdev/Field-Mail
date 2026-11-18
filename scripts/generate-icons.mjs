import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const BRAND = [0x1d, 0x4e, 0xd8, 255]; // #1d4ed8
const BRAND_MID = [0x25, 0x63, 0xeb, 255]; // #2563eb
const CARD_TINT = [0xdb, 0xea, 0xfe, 255]; // #dbeafe
const PAPER = [0xff, 0xff, 0xff, 255];
const SS = 4;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function createCanvas(size) {
  return { size, pixels: new Uint8Array(size * size * 4) };
}

function blend(canvas, x, y, colour, coverage) {
  if (coverage <= 0) return;
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) return;
  const i = (y * canvas.size + x) * 4;
  const a = Math.min(1, coverage) * (colour[3] / 255);
  const p = canvas.pixels;
  const dstA = p[i + 3] / 255;
  const outA = a + dstA * (1 - a);
  if (outA === 0) return;
  for (let c = 0; c < 3; c++) {
    p[i + c] = Math.round((colour[c] * a + p[i + c] * dstA * (1 - a)) / outA);
  }
  p[i + 3] = Math.round(outA * 255);
}

function roundRectDistance(px, py, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const dx = Math.abs(px - cx) - (w / 2 - r);
  const dy = Math.abs(py - cy) - (h / 2 - r);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(dx, dy), 0) - r;
}

function fillRoundRect(canvas, x, y, w, h, radius, colour) {
  const minX = Math.max(0, Math.floor(x) - 1);
  const maxX = Math.min(canvas.size - 1, Math.ceil(x + w) + 1);
  const minY = Math.max(0, Math.floor(y) - 1);
  const maxY = Math.min(canvas.size - 1, Math.ceil(y + h) + 1);
  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const d = roundRectDistance(px + 0.5, py + 0.5, x, y, w, h, radius);
      blend(canvas, px, py, colour, 0.5 - d);
    }
  }
}

function segDistance(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len2));
  const dx = px - (x1 + t * vx);
  const dy = py - (y1 + t * vy);
  return Math.sqrt(dx * dx + dy * dy);
}

function strokeLine(canvas, x1, y1, x2, y2, thickness, colour) {
  const r = thickness / 2;
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - r - 2));
  const maxX = Math.min(canvas.size - 1, Math.ceil(Math.max(x1, x2) + r + 2));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - r - 2));
  const maxY = Math.min(canvas.size - 1, Math.ceil(Math.max(y1, y2) + r + 2));
  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const d = segDistance(px + 0.5, py + 0.5, x1, y1, x2, y2) - r;
      blend(canvas, px, py, colour, 0.5 - d);
    }
  }
}

function downsample(canvas, targetSize) {
  const factor = canvas.size / targetSize;
  const out = Buffer.alloc(targetSize * targetSize * 4);
  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = 0; sy < factor; sy++) {
        for (let sx = 0; sx < factor; sx++) {
          const i = ((y * factor + sy) * canvas.size + (x * factor + sx)) * 4;
          const alpha = canvas.pixels[i + 3] / 255;
          r += canvas.pixels[i] * alpha;
          g += canvas.pixels[i + 1] * alpha;
          b += canvas.pixels[i + 2] * alpha;
          a += alpha;
          n++;
        }
      }
      const o = (y * targetSize + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round((a / n) * 255);
    }
  }
  return out;
}

// Fieldmail mark: document emerging from envelope on blue rounded tile.
function drawMark(canvas, { bgRadiusRatio, glyphScale, background }) {
  const S = canvas.size;
  const bg = { ...background };

  fillRoundRect(canvas, 0, 0, S, S, bgRadiusRatio > 0 ? S * bgRadiusRatio : 0, bg);

  const g = S * glyphScale;
  const cx = S / 2;
  const cy = S / 2;
  const px = (u) => cx + (u - 0.5) * g;
  const py = (u) => cy + (u - 0.5) * g;

  // Report sheet rising from top of envelope
  const docX = px(0.24);
  const docY = py(0.14);
  const docW = g * 0.52;
  const docH = g * 0.45;
  fillRoundRect(canvas, docX, docY, docW, docH, g * 0.055, CARD_TINT);

  // Two report lines on the document card
  fillRoundRect(canvas, px(0.32), py(0.23), g * 0.22, g * 0.048, g * 0.024, BRAND);
  fillRoundRect(canvas, px(0.32), py(0.32), g * 0.35, g * 0.048, g * 0.024, BRAND_MID);

  // Envelope body
  const envX = px(0.14);
  const envY = py(0.41);
  const envW = g * 0.72;
  const envH = g * 0.46;
  fillRoundRect(canvas, envX, envY, envW, envH, g * 0.075, PAPER);

  // Envelope V-flap chevron
  const strokeW = g * 0.056;
  strokeLine(canvas, px(0.165), py(0.435), px(0.5), py(0.64), strokeW, BRAND_MID);
  strokeLine(canvas, px(0.5), py(0.64), px(0.835), py(0.435), strokeW, BRAND_MID);
}

function writeIcon(name, size, options) {
  const canvas = createCanvas(size * SS);
  drawMark(canvas, options);
  const pixels = downsample(canvas, size);
  writeFileSync(join(OUT_DIR, name), encodePng(size, size, pixels));
  console.log(`  ${name}  ${size}x${size}`);
}

console.log('Generating Fieldmail PWA icons…');
mkdirSync(join(OUT_DIR, 'icons'), { recursive: true });

writeIcon('icons/icon-192.png', 192, { bgRadiusRatio: 0.22, glyphScale: 0.88, background: BRAND });
writeIcon('icons/icon-512.png', 512, { bgRadiusRatio: 0.22, glyphScale: 0.88, background: BRAND });
writeIcon('icons/maskable-512.png', 512, { bgRadiusRatio: 0, glyphScale: 0.64, background: BRAND });
writeIcon('apple-touch-icon.png', 180, { bgRadiusRatio: 0, glyphScale: 0.7, background: BRAND });

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Fieldmail">
  <defs>
    <linearGradient id="fm-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#fm-bg)"/>
  <rect x="140" y="90" width="232" height="220" rx="30" fill="#dbeafe"/>
  <rect x="178" y="135" width="102" height="24" rx="12" fill="#1d4ed8"/>
  <rect x="178" y="182" width="156" height="24" rx="12" fill="#2563eb"/>
  <path d="M88 214C88 202.95 96.95 194 108 194H404C415.05 194 424 202.95 424 214V378C424 399 407 416 386 416H126C105 416 88 399 88 378V214Z" fill="#ffffff"/>
  <path d="M98 206L256 312L414 206" fill="none" stroke="#2563eb" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
writeFileSync(join(OUT_DIR, 'favicon.svg'), favicon);
console.log('  favicon.svg');
