// Derives all brand image assets from public/sslogo.png (the white-text,
// dark-background master lockup on a transparent canvas).
//
//   node scripts/generate-logo-variants.mjs
//
// Outputs (all written into public/):
//   sslogo.png          - main lockup, downscaled to a web-friendly size
//   sslogo-dark.png     - light-background variant (navy text, same ribbon)
//   favicon-32.png      - S-ribbon mark on transparent canvas (browser tab)
//   favicon-16.png      - S-ribbon mark on transparent canvas (browser tab)
//   pwa-512.png         - PWA icon, navy square + white ribbon mark (any + maskable)
//   pwa-192.png         - PWA icon, navy square + white ribbon mark
//   apple-touch-icon.png- 180px iOS icon, navy square + white ribbon mark
//   logo-150x150.png    - square mark, navy square + white ribbon (PWA prompt / fallback)
//
// Keep the master sslogo.png high-quality; rerun this script after swapping it.

import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const PUBLIC = new URL('../public/', import.meta.url);
const NAVY = [0x0d, 0x12, 0x30]; // #0d1230 - public-site header navy

function load(name) {
  return PNG.sync.read(readFileSync(new URL(name, PUBLIC)));
}
function save(png, name) {
  writeFileSync(new URL(name, PUBLIC), PNG.sync.write(png, { deflateLevel: 9 }));
}

// --- helpers -----------------------------------------------------------

function isAchromatic(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b) <= 60;
}

// Recolor near-white pixels to NAVY while preserving alpha, so the lockup
// stays correct on light backgrounds. Colored ribbon pixels are untouched;
// grey blend pixels (anti-aliasing between text and ribbon) are mapped to
// navy with luminance-derived alpha.
function recolorText(src, to) {
  const out = new PNG({ width: src.width, height: src.height });
  out.data.set(src.data);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
    if (a === 0) continue;
    if (isAchromatic(r, g, b)) {
      const lum = (r + g + b) / 3;
      const alpha = Math.round((a * lum) / 255);
      d[i] = to[0];
      d[i + 1] = to[1];
      d[i + 2] = to[2];
      d[i + 3] = alpha;
    }
  }
  return out;
}

// Bilinear resample on premultiplied alpha to avoid fringing halos.
function resize(src, w, h) {
  const out = new PNG({ width: w, height: h });
  const sd = src.data, dd = out.data;
  const sx = src.width / w, sy = src.height / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fx = (x + 0.5) * sx - 0.5, fy = (y + 0.5) * sy - 0.5;
      const x0 = Math.max(0, Math.floor(fx)), y0 = Math.max(0, Math.floor(fy));
      const x1 = Math.min(src.width - 1, x0 + 1), y1 = Math.min(src.height - 1, y0 + 1);
      const wx = fx - x0, wy = fy - y0;
      const di = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        // premultiply
        const pm = (si) => {
          const a = sd[si + 3] / 255;
          return [sd[si + c] * a, a];
        };
        const p00 = pm((y0 * src.width + x0) * 4), p10 = pm((y0 * src.width + x1) * 4);
        const p01 = pm((y1 * src.width + x0) * 4), p11 = pm((y1 * src.width + x1) * 4);
        const top = p00[0] * (1 - wx) + p10[0] * wx;
        const bot = p01[0] * (1 - wx) + p11[0] * wx;
        const alpha = (p00[1] * (1 - wx) + p10[1] * wx) * (1 - wy) +
                      (p01[1] * (1 - wx) + p11[1] * wx) * wy;
        const v = top * (1 - wy) + bot * wy;
        // unpremultiply
        dd[di + c] = alpha > 0.0005 ? Math.round(v / alpha) : 0;
        if (c === 3) dd[di + 3] = Math.round(alpha * 255);
      }
    }
  }
  return out;
}

// Fit the lockup onto a solid square (icons).
function toSquare(src, size, bg, insetRatio) {
  const out = new PNG({ width: size, height: size });
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = bg[0]; d[i + 1] = bg[1]; d[i + 2] = bg[2]; d[i + 3] = 255;
  }
  const maxSide = size * (1 - insetRatio);
  const s = Math.min(maxSide / src.width, maxSide / src.height);
  const lw = Math.max(1, Math.round(src.width * s));
  const lh = Math.max(1, Math.round(src.height * s));
  const icon = resize(src, lw, lh);
  const ox = Math.round((size - lw) / 2), oy = Math.round((size - lh) / 2);
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const si = (y * lw + x) * 4, di = ((y + oy) * size + (x + ox)) * 4;
      const a = icon.data[si + 3] / 255;
      for (let c = 0; c < 3; c++) {
        d[di + c] = Math.round(icon.data[si + c] * a + d[di + c] * (1 - a));
      }
      d[di + 3] = 255;
    }
  }
  return out;
}

// --- build -------------------------------------------------------------

const master = load('sslogo.png');
const targetW = Math.min(1100, master.width);

const webSize = resize(master, targetW, Math.round((targetW * master.height) / master.width));
save(webSize, 'sslogo.png');

save(recolorText(webSize, NAVY), 'sslogo-dark.png');

// The S-ribbon mark: flood-fill the connected glyph containing the
// leftmost opaque pixel (robust even where the ribbon horizontally
// overlaps the wordmark's columns).
function ribbonCrop(png) {
  const W = png.width, H = png.height, d = png.data;
  const solid = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) solid[p] = d[i + 3] > 64 ? 1 : 0;

  let seed = -1;
  outer: for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      if (solid[y * W + x]) { seed = y * W + x; break outer; }
    }
  }
  if (seed < 0) throw new Error('sslogo.png has no opaque pixels');

  const seen = new Uint8Array(W * H);
  const stack = [seed];
  seen[seed] = 1;
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  while (stack.length) {
    const p = stack.pop();
    const px = p % W, py = (p / W) | 0;
    if (px < x0) x0 = px;
    if (px > x1) x1 = px;
    if (py < y0) y0 = py;
    if (py > y1) y1 = py;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const np = ny * W + nx;
        if (!seen[np] && solid[np]) { seen[np] = 1; stack.push(np); }
      }
    }
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((y + y0) * W + (x + x0)) * 4, di = (y * w + x) * 4;
      // keep only pixels belonging to the ribbon component
      const inMark = seen[(y + y0) * W + (x + x0)] ? 255 : 0;
      out.data[di] = d[si];
      out.data[di + 1] = d[si + 1];
      out.data[di + 2] = d[si + 2];
      out.data[di + 3] = Math.min(d[si + 3], inMark);
    }
  }
  return out;
}

const mark = ribbonCrop(webSize);

// Generate favicons at the ribbon's natural aspect ratio so the S-mark
  // doesn't get squashed into a square canvas. Browsers will show the
  // declared size; if a square canvas is needed, add width/height attrs
  // or use CSS object-fit: contain.
  const markSize = Math.min(webSize.width, webSize.height); // the logo's bounding box

  // Favicon-32: render the mark at natural size within 32x32, centered.
  const fav32 = new PNG({ width: 32, height: 32 });
  const df32 = fav32.data;
  // fill transparent bg first
  for (let i = 0; i < df32.length; i += 4) { df32[i] = 0; df32[i+1] = 0; df32[i+2] = 0; df32[i+3] = 0; }
  const mx = Math.round((32 - markSize) / 2), my = Math.round((32 - markSize) / 2);
  for (let y = 0; y < markSize; y++) {
    for (let x = 0; x < markSize; x++) {
      const si = (y * markSize + x) * 4, di = (((my + y) * 32) + (mx + x)) * 4;
      for (let c = 0; c < 4; c++) df32[di + c] = webSize.data[si + c];
    }
  }
  save(fav32, 'favicon-32.png');

  // Favicon-16: same, at 16px.
  const fav16 = new PNG({ width: 16, height: 16 });
  const df16 = fav16.data;
  for (let i = 0; i < df16.length; i += 4) { df16[i] = 0; df16[i+1] = 0; df16[i+2] = 0; df16[i+3] = 0; }
  const mx16 = Math.round((16 - markSize) / 2), my16 = Math.round((16 - markSize) / 2);
  for (let y = 0; y < markSize; y++) {
    for (let x = 0; x < markSize; x++) {
      const si = (y * markSize + x) * 4, di = (((my16 + y) * 16) + (mx16 + x)) * 4;
      for (let c = 0; c < 4; c++) df16[di + c] = webSize.data[si + c];
    }
  }
  save(fav16, 'favicon-16.png');

// Square app icons: white ribbon mark on the site navy.
for (const [file, size] of [
  ['pwa-512.png', 512],
  ['pwa-192.png', 192],
  ['apple-touch-icon.png', 180],
  ['logo-150x150.png', 150],
]) {
  save(toSquare(mark, size, NAVY, 0.2), file);
}

// Regenerate the inline email-logo data URI (src/utils/safeguardLogoDataUri.ts).
// Emails show the logo at <= 280px wide, so a 543px dark variant is plenty and
// keeps the embedded payload small.
const emailTs = new URL('../src/utils/safeguardLogoDataUri.ts', import.meta.url);
const emailWidth = 543;
const emailPng = recolorText(
  resize(master, emailWidth, Math.round((emailWidth * master.height) / master.width)),
  NAVY,
);
const emailB64 = PNG.sync.write(emailPng, { deflateLevel: 9 }).toString('base64');
writeFileSync(
  emailTs,
  `// Downscaled base64 copy of public/sslogo-dark.png, embedded inline so email
// logos never depend on a network fetch to the app's own hosting - some mail
// clients block remote images by default, and sandboxed previews can block
// cross-origin image requests entirely. Regenerated automatically by
// scripts/generate-logo-variants.mjs when the master sslogo.png changes.
export const SAFEGUARD_LOGO_DATA_URI =
  'data:image/png;base64,${emailB64}';
`,
);

console.log('generated logo variants from sslogo.png');
