/**
 * Generate OG images, social cards, and favicon pack from public/logo.png
 * Run: node scripts/generate-seo-assets.mjs
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const logoPath = path.join(root, 'public', 'logo.png');
const faviconDir = path.join(root, 'public', 'favicon');
const appDir = path.join(root, 'app');

const BRAND = {
  name: 'Upscale Vintage',
  tagline: 'Fashion · Lifestyle · Imported Finds',
  sub: 'Curated for modern everyday glam · Accra, Ghana',
  cream: '#FAF6F2',
  espresso: '#6B3E2E',
  mauve: '#C58A94',
  champagne: '#D4B06A',
};

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

function ogSvg(width, height) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${BRAND.cream}"/>
      <stop offset="45%" style="stop-color:#E8D7CC"/>
      <stop offset="100%" style="stop-color:${BRAND.mauve};stop-opacity:0.35"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${BRAND.champagne}"/>
      <stop offset="100%" style="stop-color:${BRAND.espresso}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <circle cx="1050" cy="120" r="180" fill="${BRAND.champagne}" opacity="0.2"/>
  <circle cx="150" cy="520" r="220" fill="${BRAND.mauve}" opacity="0.15"/>
  <rect x="0" y="0" width="8" height="100%" fill="url(#accent)"/>
  <text x="520" y="280" font-family="Georgia, serif" font-size="72" font-weight="600" fill="${BRAND.espresso}">${BRAND.name}</text>
  <text x="520" y="340" font-family="Arial, sans-serif" font-size="32" fill="${BRAND.espresso}" opacity="0.85">${BRAND.tagline}</text>
  <text x="520" y="390" font-family="Arial, sans-serif" font-size="24" fill="${BRAND.espresso}" opacity="0.65">${BRAND.sub}</text>
</svg>`);
}

async function buildOgImage(width, height, outFile) {
  const bg = await sharp(ogSvg(width, height)).png().toBuffer();
  const logoH = Math.round(height * 0.62);
  const logo = await sharp(logoPath).resize({ height: logoH, fit: 'inside' }).png().toBuffer();
  const meta = await sharp(logo).metadata();
  const left = Math.round(width * 0.06);
  const top = Math.round((height - (meta.height || logoH)) / 2);

  await sharp(bg)
    .composite([{ input: logo, left, top }])
    .png({ quality: 95, compressionLevel: 6 })
    .toFile(outFile);
  console.log('  ✓', path.relative(root, outFile));
}

async function buildFavicon(size, outFile, bg = null) {
  let pipeline = sharp(logoPath).resize(size, size, {
    fit: 'contain',
    background: bg || { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (size >= 180 && bg) {
    pipeline = sharp({
      create: { width: size, height: size, channels: 4, background: bg },
    })
      .composite([
        {
          input: await sharp(logoPath)
            .resize(Math.round(size * 0.82), Math.round(size * 0.82), { fit: 'inside' })
            .toBuffer(),
          gravity: 'centre',
        },
      ]);
  }
  await pipeline.png().toFile(outFile);
  console.log('  ✓', path.relative(root, outFile));
}

async function buildMultiIco() {
  const sizes = [16, 32, 48];
  const pngs = [];
  for (const s of sizes) {
    const p = path.join(faviconDir, `favicon-${s}x${s}.png`);
    await buildFavicon(s, p);
    pngs.push(p);
  }
  const icoPath = path.join(faviconDir, 'favicon.ico');
  await sharp(pngs[1]).toFile(icoPath);
  console.log('  ✓', path.relative(root, icoPath), '(32px base)');
}

async function main() {
  if (!fs.existsSync(logoPath)) {
    console.error('Missing public/logo.png — add your logo first.');
    process.exit(1);
  }

  await ensureDir(faviconDir);

  console.log('\nGenerating social images…');
  await buildOgImage(1200, 630, path.join(root, 'public', 'og-image.png'));
  await buildOgImage(1200, 630, path.join(root, 'public', 'twitter-card.png'));
  await buildOgImage(1200, 1200, path.join(root, 'public', 'og-image-square.png'));

  console.log('\nGenerating favicon pack…');
  const cream = { r: 250, g: 246, b: 242, alpha: 1 };
  await buildFavicon(16, path.join(faviconDir, 'favicon-16x16.png'));
  await buildFavicon(32, path.join(faviconDir, 'favicon-32x32.png'));
  await buildFavicon(48, path.join(faviconDir, 'favicon-48x48.png'));
  await buildFavicon(180, path.join(faviconDir, 'apple-touch-icon.png'), cream);
  await buildFavicon(192, path.join(faviconDir, 'android-chrome-192x192.png'), cream);
  await buildFavicon(512, path.join(faviconDir, 'android-chrome-512x512.png'), cream);
  await buildMultiIco();

  const fav32 = path.join(faviconDir, 'favicon-32x32.png');
  await fs.promises.copyFile(fav32, path.join(appDir, 'icon.png'));
  await fs.promises.copyFile(path.join(faviconDir, 'apple-touch-icon.png'), path.join(appDir, 'apple-icon.png'));
  await fs.promises.copyFile(path.join(faviconDir, 'favicon.ico'), path.join(appDir, 'favicon.ico'));
  console.log('  ✓ app/icon.png, app/apple-icon.png, app/favicon.ico');

  const webmanifest = {
    name: BRAND.name,
    short_name: 'Upscale',
    icons: [
      { src: '/favicon/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/favicon/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    theme_color: BRAND.espresso,
    background_color: BRAND.cream,
    display: 'standalone',
  };
  await fs.promises.writeFile(
    path.join(faviconDir, 'site.webmanifest'),
    JSON.stringify(webmanifest, null, 2)
  );
  console.log('  ✓ public/favicon/site.webmanifest');
  console.log('\nDone.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
