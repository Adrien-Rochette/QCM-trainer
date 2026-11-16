// Génère les icônes PNG de la PWA (sans dépendance) à partir du dessin du logo QuizLab.
// Usage : node scripts/generate-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const FROM = [0x63, 0x66, 0xf1]; // indigo-500
const TO = [0x7c, 0x3a, 0xed]; // violet-600
const CHECK = [0x63, 0x66, 0xf1];

function insideRoundedRect(x, y, size, r) {
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function insideTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Couleur RGBA d'un point en coordonnées logo (0..64). */
function sample(x, y, { rounded, scale }) {
  const inBg = rounded ? insideRoundedRect(x, y, 64, 16) : x >= 0 && y >= 0 && x <= 64 && y <= 64;
  if (!inBg) return [0, 0, 0, 0];
  // Le contenu (bulle + coche) peut être réduit autour du centre (zone sûre des icônes « maskable »).
  const u = 32 + (x - 32) / scale;
  const v = 32 + (y - 32) / scale;
  const inBubble =
    ((u - 32) / 19) ** 2 + ((v - 31) / 17) ** 2 <= 1 || insideTriangle(u, v, [19, 39], [17, 51], [29, 45.5]);
  if (inBubble) {
    const d = Math.min(distToSegment(u, v, 24, 31.5, 29.5, 37), distToSegment(u, v, 29.5, 37, 41, 25.5));
    if (d <= 2.5) return [...CHECK, 255];
    return [255, 255, 255, 255];
  }
  const t = (x + y) / 128;
  return [0, 1, 2].map((i) => Math.round(FROM[i] + (TO[i] - FROM[i]) * t)).concat(255);
}

function render(size, options) {
  const ss = 4; // sur-échantillonnage pour lisser les bords
  const data = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = ((px + (sx + 0.5) / ss) / size) * 64;
          const y = ((py + (sy + 0.5) / ss) / size) * 64;
          const [r, g, b, a] = sample(x, y, options);
          acc[0] += r * a;
          acc[1] += g * a;
          acc[2] += b * a;
          acc[3] += a;
        }
      }
      const o = (py * size + px) * 4;
      const alpha = acc[3] / (ss * ss);
      data[o] = acc[3] ? Math.round(acc[0] / acc[3]) : 0;
      data[o + 1] = acc[3] ? Math.round(acc[1] / acc[3]) : 0;
      data[o + 2] = acc[3] ? Math.round(acc[2] / acc[3]) : 0;
      data[o + 3] = Math.round(alpha);
    }
  }
  return encodePng(size, size, data);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, payload) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(payload.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // profondeur
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const icons = [
  { file: 'pwa-192x192.png', size: 192, rounded: true, scale: 1 },
  { file: 'pwa-512x512.png', size: 512, rounded: true, scale: 1 },
  { file: 'maskable-512x512.png', size: 512, rounded: false, scale: 0.78 },
  { file: 'apple-touch-icon.png', size: 180, rounded: false, scale: 0.85 },
];

for (const icon of icons) {
  writeFileSync(join(publicDir, icon.file), render(icon.size, icon));
  console.log(`✓ public/${icon.file}`);
}
