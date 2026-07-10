// Erzeugt icon.png (512x512) ohne externe Abhängigkeiten.
// Ember-gerundetes Quadrat mit fünf weißen Balken (wie das Web-Icon).
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const S = 512;
const EMBER = [249, 115, 22];
const WHITE = [255, 255, 255];
const BG_RADIUS = 120;

// Balken skaliert x4 aus dem 128er-Viewport des Web-Icons
const BARS = [
  [96, 208, 36, 96],
  [164, 160, 36, 192],
  [232, 104, 36, 304],
  [300, 176, 36, 160],
  [368, 224, 36, 64],
];
const BAR_R = 18;

function inRoundRect(px, py, x0, y0, x1, y1, r) {
  if (px < x0 || px >= x1 || py < y0 || py >= y1) return false;
  const cx = px < x0 + r ? x0 + r : px >= x1 - r ? x1 - r : px;
  const cy = py < y0 + r ? y0 + r : py >= y1 - r ? y1 - r : py;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

const rgba = Buffer.alloc(S * S * 4);
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    let col = null;
    for (const [bx, by, bw, bh] of BARS) {
      if (inRoundRect(x + 0.5, y + 0.5, bx, by, bx + bw, by + bh, BAR_R)) {
        col = WHITE;
        break;
      }
    }
    if (!col && inRoundRect(x + 0.5, y + 0.5, 0, 0, S, S, BG_RADIUS)) col = EMBER;
    if (col) {
      rgba[i] = col[0];
      rgba[i + 1] = col[1];
      rgba[i + 2] = col[2];
      rgba[i + 3] = 255;
    }
  }
}

// PNG-Kodierung
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(td), 0);
  return Buffer.concat([len, td, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
// 10-12: compression, filter, interlace = 0

const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0; // Filter: none
  rgba.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

fs.mkdirSync(path.join(__dirname, "build"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "build", "icon.png"), png);
fs.writeFileSync(path.join(__dirname, "icon.png"), png);
console.log("icon.png geschrieben:", png.length, "Bytes");
