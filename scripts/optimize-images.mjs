// Prepares brand assets and responsive photos from the untouched originals in images/.
// The originals are not kept in git (repo size); copy them back into images/ before running.
// Licence records stay in images/*/SOURCES.md.
// Run with: node scripts/optimize-images.mjs            (everything)
//           node scripts/optimize-images.mjs --brand    (logos, mark, icons and OG image only)
//           node scripts/optimize-images.mjs --icons    (favicon and app icons only)
// Outputs: Public/brand/* (logo, logo-white, mark, icons, OG image) and Public/images/site/* (WebP + JPG per width),
// plus src/data/siteImages.ts (the manifest <ResponsiveImage> reads).
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'images');
const BRAND_OUT = path.join(ROOT, 'Public', 'brand');
const PHOTO_OUT = path.join(ROOT, 'Public', 'images', 'site');
const MANIFEST_OUT = path.join(ROOT, 'src', 'data', 'siteImages.ts');

const STEP_WIDTHS = [640, 1024, 1600, 2400];
// Every card/tile photo is cropped to this exact square so rows line up at the same height.
// 340 px is the base size (the smallest card source when the cards were set up); larger squares follow.
const CARD_SIZE = 340;
// Larger square variants for retina screens, emitted only when the source is big enough.
const CARD_STEP_SIZES = [640, 1024, 1400];

fs.mkdirSync(BRAND_OUT, { recursive: true });
fs.mkdirSync(PHOTO_OUT, { recursive: true });

// ---------------------------------------------------------------------------------------------
// Logo: the supplied logo (images/Nov-logo.png) is an opaque PNG on a light grey paper texture
// (whiteness ~230-255) with a white glow around the letters. "Colour to alpha" against white
// turns the paper and glow fully transparent and keeps anti-aliased edges smooth, without a
// grey fringe. Stray darker specks in the texture are cleared afterwards by dropSpecks().
// ---------------------------------------------------------------------------------------------
const LOGO_SRC = 'Nov-logo.png';

// low:  at or below this "whiteness" (min of R, G, B) a pixel is fully opaque.
// high: at or above it the pixel is background; set just under the paper texture's darkest tone.
async function whiteToAlpha(input, { low = 60, high = 232 } = {}) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const whiteness = Math.min(r, g, b);
    let a = whiteness <= low ? 1 : 1 - (whiteness - low) / (high - low);
    a = Math.max(0, Math.min(1, a));
    if (a < 0.04) a = 0; // faint texture noise
    if (a > 0) {
      // Un-blend from white so edge pixels keep their true colour.
      out[j] = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - a)) / a)));
      out[j + 1] = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - a)) / a)));
      out[j + 2] = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - a)) / a)));
    }
    out[j + 3] = Math.round(a * 255);
  }
  dropSpecks(out, info.width, info.height);
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// Clears connected blobs that are tiny or never reach solid opacity: texture specks, not artwork.
// Real artwork (even the tagline's comma) always contains near-opaque pixels.
function dropSpecks(rgba, width, height, { minArea = 8, minPeak = 150 } = {}) {
  const n = width * height;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const blob = [];
  for (let start = 0; start < n; start++) {
    if (seen[start] || rgba[start * 4 + 3] === 0) continue;
    let top = 0, peak = 0;
    blob.length = 0;
    stack[top++] = start; seen[start] = 1;
    while (top) {
      const p = stack[--top];
      blob.push(p);
      peak = Math.max(peak, rgba[p * 4 + 3]);
      const x = p % width, y = (p - x) / width;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (!seen[q] && rgba[q * 4 + 3] > 0) { seen[q] = 1; stack[top++] = q; }
      }
    }
    if (blob.length < minArea || peak < minPeak) for (const p of blob) rgba[p * 4 + 3] = 0;
  }
}

// Crops to the artwork's bounding box (every pixel with alpha > 0).
async function trimTransparent(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] === 0) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return sharp(pngBuffer).extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }).png().toBuffer();
}

// How strongly a pixel reads as the logo's red (0 = neutral grey/black/white).
const redness = (r, g, b) => r - Math.max(g, b);
const RED_MIN = 60;

// Reversed logo for dark surfaces: every non-red pixel becomes white; red stays red.
async function toWhiteVersion(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (redness(data[i], data[i + 1], data[i + 2]) < RED_MIN) {
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// Keeps only the red parts of an image (the globe, arrow and parcel of the mark).
async function redOnly(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const red = redness(data[i], data[i + 1], data[i + 2]);
    if (red < RED_MIN) data[i + 3] = 0;
    else if (red < RED_MIN + 40) data[i + 3] = Math.round(data[i + 3] * (red - RED_MIN) / 40); // soft edge
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// Icon mark: the red globe, swoosh, arrow and parcel that form the "O" of NAVORA, without the
// black letterforms around them, centred on a transparent square. Crop box measured on the
// 2024x777 original (includes the arrow tip over the "R", stops above "FREIGHT").
async function buildSquareMark(transparent) {
  const MARK = { left: 1085, top: 160, width: 490, height: 292 };
  const markRed = await redOnly(await sharp(transparent).extract(MARK).png().toBuffer());
  const mark = await trimTransparent(markRed);
  const markMeta = await sharp(mark).metadata();
  const side = Math.max(markMeta.width, markMeta.height);
  return sharp(mark)
    .extend({
      top: Math.floor((side - markMeta.height) / 2), bottom: Math.ceil((side - markMeta.height) / 2),
      left: Math.floor((side - markMeta.width) / 2), right: Math.ceil((side - markMeta.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png().toBuffer();
}

// Browser, home-screen and PWA icons, all rendered straight from the square mark at their exact
// size (never resized from another icon). `inset` is the share of the canvas the mark may fill.
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const ICONS = [
  // Tab icons sit on a white rounded tile so the red mark stays visible on dark browser tabs.
  { file: 'favicon-16.png', size: 16, inset: 1, bg: '#ffffff', tile: true },  // browser tab (standard DPI)
  { file: 'favicon-32.png', size: 32, inset: 0.94, bg: '#ffffff', tile: true }, // browser tab (retina), taskbar
  { file: 'icon-192.png', size: 192, inset: 0.92, bg: CLEAR },        // Android home screen, manifest
  { file: 'favicon.png', size: 512, inset: 0.92, bg: CLEAR },         // manifest, install splash
  { file: 'icon-maskable-512.png', size: 512, inset: 0.64, bg: '#ffffff' }, // Android adaptive: fits the 80% safe circle
  { file: 'apple-touch-icon.png', size: 180, inset: 0.76, bg: '#ffffff' },  // iOS fills transparency with black, so white
];

async function buildIcons(squareMark) {
  for (const { file, size, inset, bg, tile } of ICONS) {
    const inner = Math.round(size * inset);
    const edge = size - inner;
    let icon = sharp(squareMark)
      .resize(inner, inner, { fit: 'contain', background: CLEAR, kernel: 'lanczos3' })
      .extend({ top: Math.floor(edge / 2), bottom: Math.ceil(edge / 2), left: Math.floor(edge / 2), right: Math.ceil(edge / 2), background: CLEAR });
    if (tile) {
      const r = Math.round(size * 0.22);
      const card = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${bg}"/></svg>`);
      icon = sharp(card).composite([{ input: await icon.png().toBuffer() }]);
    } else if (bg !== CLEAR) {
      icon = sharp(await icon.png().toBuffer()).flatten({ background: bg });
    }
    // Full-colour PNG for the tiny sizes: palette quantising visibly bands 16/32 px edges.
    const png = size <= 32 ? { compressionLevel: 9 } : { palette: true, quality: 95, effort: 10, compressionLevel: 9 };
    await icon.png(png).toFile(path.join(BRAND_OUT, file));
  }
}

const LOGO_PNG = { palette: true, quality: 90, effort: 10, compressionLevel: 9 };
const OG_BACKGROUND = '#181818'; // --ngf-ink-950, the dark hero/footer surface
const OG_LOGO_WIDTH = 900;

async function buildBrand() {
  const transparent = await whiteToAlpha(path.join(SRC, LOGO_SRC));
  const trimmed = await trimTransparent(transparent);
  await sharp(trimmed).png(LOGO_PNG).toFile(path.join(BRAND_OUT, 'logo.png'));

  const white = await toWhiteVersion(trimmed);
  await sharp(white).png(LOGO_PNG).toFile(path.join(BRAND_OUT, 'logo-white.png'));

  const squareMark = await buildSquareMark(transparent);
  await sharp(squareMark).png(LOGO_PNG).toFile(path.join(BRAND_OUT, 'mark.png'));
  await buildIcons(squareMark);

  // OG image 1200x630: reversed logo centred on the brand Ink. Never upscaled.
  const { width: logoW } = await sharp(white).metadata();
  const ogLogo = await sharp(white).resize({ width: Math.min(OG_LOGO_WIDTH, logoW), kernel: 'lanczos3' }).png().toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: OG_BACKGROUND } })
    .composite([{ input: ogLogo, gravity: 'centre' }])
    .flatten({ background: OG_BACKGROUND })
    .jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(BRAND_OUT, 'og-image.jpg'));
}

// ---------------------------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------------------------
// kind 'card' = fixed CARD_SIZE square (plus 640 when the source allows it).
// kind 'hero' = keeps the given aspect ratio, widths from STEP_WIDTHS up to the source width (or `maxWidth`).
// free-stock/* are full-resolution Pexels originals (see images/free-stock/SOURCES.md); each hero
// slot has its own photo. Outputs stay capped at STEP_WIDTHS / CARD_STEP_SIZES.
const PHOTOS = [
  { name: 'hero-home', src: 'free-stock/hero-home.jpg', kind: 'hero', aspect: 16 / 9 },
  // Phones only (below 768px): 1290 px covers a 430 px-wide screen at 3x, so larger portrait files are never needed.
  { name: 'hero-home-mobile', src: 'free-stock/hero-home-mobile.jpg', kind: 'hero', aspect: 9 / 16, maxWidth: 1290 },
  { name: 'track-hero', src: 'free-stock/track-hero.jpg', kind: 'hero', aspect: 2 / 1 },
  { name: 'locations-hero', src: 'free-stock/locations-hero.jpg', kind: 'hero', aspect: 2 / 1 },
  // Wide strip behind the Home callback banner.
  { name: 'callback-banner', src: 'free-stock/callback-banner.jpg', kind: 'hero', aspect: 3 / 1 },
  { name: 'services-hero', src: 'free-stock/services-hero.jpg', kind: 'hero', aspect: 12 / 5 },
  { name: 'about-hero', src: 'free-stock/about-hero.jpg', kind: 'hero', aspect: 12 / 5 },
  // About has its own photos so nothing on that page repeats another page's image.
  { name: 'about-compliance', src: 'free-stock/about-compliance.jpg', kind: 'hero', aspect: 3 / 1 },
  // CSS background heroes (ShipPage.css, PublicQuoteResultPage.css) reference the 1024 and 1600 widths.
  // Rippled sea compresses poorly; it sits under a dark overlay, so lower quality keeps 1600w under 250 KB.
  { name: 'ship-hero', src: 'free-stock/ship-hero.jpg', kind: 'hero', aspect: 16 / 9, quality: { webp: 66, jpeg: 70 } },
  { name: 'quote-result-hero', src: 'free-stock/quote-result-hero.jpg', kind: 'hero', aspect: 16 / 9 },
  { name: 'service-priority-express', src: 'free-stock/service-priority-express.jpg', kind: 'card' },
  { name: 'service-freight-linehaul', src: 'free-stock/service-freight-linehaul.jpg', kind: 'card' },
  { name: 'service-vehicle-transport', src: 'free-cc0/service-vehicle-transport.webp', kind: 'card' },
  { name: 'service-secure-vault', src: 'free-cc0/service-secure-vault.webp', kind: 'card' },
  { name: 'industry-healthcare', src: 'free-stock/industry-healthcare.jpg', kind: 'card' },
  { name: 'industry-technology', src: 'free-cc0/industry-technology.webp', kind: 'card' },
  { name: 'industry-automotive', src: 'free-stock/industry-automotive.jpg', kind: 'card' },
  { name: 'industry-ecommerce', src: 'free-stock/industry-ecommerce.jpg', kind: 'card' },
  { name: 'track-result-vehicle', src: 'free-stock/track-result-vehicle.jpg', kind: 'card' },
  { name: 'about-operations', src: 'free-pexels/about-operations.jpg', kind: 'card' },
  { name: 'about-story', src: 'free-stock/about-story.jpg', kind: 'card' },
  { name: 'contact-team', src: 'free-stock/contact-team.jpg', kind: 'card' },
  // Shown as a 72 px thumbnail: crop tight on the face.
  { name: 'about-team', src: 'free-pexels/about-team.jpg', kind: 'card', crop: { left: 950, top: 80, width: 900, height: 900 } },
];

// `position` picks which part of the source a cover crop keeps (sharp: 'centre', 'top', 'bottom', ...).
// `quality` overrides the encoder quality for photos that would otherwise exceed the size budget.
async function writeVariants(pipelineFactory, name, width, height, position = 'centre', quality = { webp: 78, jpeg: 80 }) {
  const base = path.join(PHOTO_OUT, `${name}-${width}`);
  await pipelineFactory().resize(width, height, { fit: 'cover', position }).webp({ quality: quality.webp }).toFile(`${base}.webp`);
  await pipelineFactory().resize(width, height, { fit: 'cover', position }).flatten({ background: '#ffffff' })
    .jpeg({ quality: quality.jpeg, mozjpeg: true, progressive: true }).toFile(`${base}.jpg`);
}

async function buildPhotos() {
  const manifest = {};
  for (const p of PHOTOS) {
    const srcPath = path.join(SRC, p.src);
    const factory = () => (p.crop ? sharp(srcPath).extract(p.crop) : sharp(srcPath));
    const meta = await factory().metadata();
    const srcW = p.crop ? p.crop.width : meta.width;
    const srcH = p.crop ? p.crop.height : meta.height;
    const variants = [];

    if (p.kind === 'card') {
      const maxSquare = Math.min(srcW, srcH);
      // Never upscale: a source smaller than CARD_SIZE is output at its own size. Every card is
      // still a 1:1 square, so CSS renders them all at the same height.
      const base = Math.min(CARD_SIZE, maxSquare);
      const sizes = [base, ...CARD_STEP_SIZES.filter(s => s <= maxSquare)];
      for (const s of sizes) {
        await writeVariants(factory, p.name, s, s);
        variants.push(s);
      }
      manifest[p.name] = { width: base, height: base, widths: variants };
    } else {
      // Largest crop of the requested aspect that fits the source, served at no more than the
      // largest step width (UHD originals are source files only), then the step widths below it.
      const cropW = Math.min(srcW, Math.floor(srcH * p.aspect));
      const maxW = Math.min(cropW, p.maxWidth ?? STEP_WIDTHS[STEP_WIDTHS.length - 1]);
      const widths = STEP_WIDTHS.filter(w => w <= maxW);
      if (!widths.includes(maxW) && (widths.length === 0 || maxW - widths[widths.length - 1] > 200)) widths.push(maxW);
      for (const w of widths) {
        await writeVariants(factory, p.name, w, Math.round(w / p.aspect), p.position, p.quality);
        variants.push(w);
      }
      manifest[p.name] = { width: maxW, height: Math.round(maxW / p.aspect), widths: variants };
    }
  }
  return manifest;
}

function writeManifest(manifest) {
  const body = Object.entries(manifest)
    .map(([k, v]) => `  '${k}': { width: ${v.width}, height: ${v.height}, widths: [${v.widths.join(', ')}] },`)
    .join('\n');
  const ts = `// Generated by scripts/optimize-images.mjs. Do not edit by hand; re-run the script instead.
// Each entry lists the widths available as /images/site/<name>-<width>.webp and .jpg.
export interface SiteImageInfo {
  width: number;
  height: number;
  widths: number[];
}

export const SITE_IMAGES = {
${body}
} satisfies Record<string, SiteImageInfo>;

export type SiteImageName = keyof typeof SITE_IMAGES;
`;
  fs.writeFileSync(MANIFEST_OUT, ts);
}

// --icons rebuilds only the icon set, leaving the logos, OG image and photos untouched.
if (process.argv.includes('--icons')) {
  await buildIcons(await buildSquareMark(await whiteToAlpha(path.join(SRC, LOGO_SRC))));
  console.log('Icons done.');
} else if (process.argv.includes('--brand')) {
  // --brand rebuilds logos, mark, icons and the OG image, leaving the photos untouched.
  await buildBrand();
  console.log('Brand done.');
} else {
  await buildBrand();
  const manifest = await buildPhotos();
  writeManifest(manifest);
  console.log('Done.');
}
