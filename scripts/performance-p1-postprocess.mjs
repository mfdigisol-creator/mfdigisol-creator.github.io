import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const INDEX_FILE = path.join(ROOT, 'index.html');
const HERO_ASSET_RELATIVE = 'assets/alhuma-home-hero-v1.webp';
const HERO_ASSET_FILE = path.join(ROOT, HERO_ASSET_RELATIVE);

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  if (!(await exists(directory))) return [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

function prioritizeFirstImageAfter(document, marker) {
  const markerIndex = document.indexOf(marker);
  if (markerIndex < 0) return { document, changed: false };

  const imageStart = document.indexOf('<img', markerIndex);
  if (imageStart < 0) return { document, changed: false };
  const imageEnd = document.indexOf('>', imageStart);
  if (imageEnd < 0) throw new Error(`Malformed image tag after ${marker}`);

  const original = document.slice(imageStart, imageEnd + 1);
  let updated = original;

  if (/\sloading=["']lazy["']/i.test(updated)) {
    updated = updated.replace(/\sloading=["']lazy["']/i, ' loading="eager"');
  } else if (!/\sloading=/i.test(updated)) {
    updated = updated.replace(/>$/, ' loading="eager">');
  }

  if (!/\sfetchpriority=/i.test(updated)) {
    updated = updated.replace(/>$/, ' fetchpriority="high">');
  }

  if (updated === original) return { document, changed: false };
  return {
    document: `${document.slice(0, imageStart)}${updated}${document.slice(imageEnd + 1)}`,
    changed: true
  };
}

async function optimizeHomepage() {
  let document = await fs.readFile(INDEX_FILE, 'utf8');
  let changed = false;

  const dataUriMatches = [...document.matchAll(/data:image\/webp;base64,[A-Za-z0-9+/=]+/g)].map(match => match[0]);
  const counts = new Map();
  for (const uri of dataUriMatches) counts.set(uri, (counts.get(uri) || 0) + 1);
  const duplicatedHero = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[0].length - a[0].length)[0]?.[0];

  if (duplicatedHero) {
    const encoded = duplicatedHero.slice('data:image/webp;base64,'.length);
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length < 1024 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
      throw new Error('Refusing to externalize an invalid homepage WebP data URI.');
    }
    await fs.mkdir(path.dirname(HERO_ASSET_FILE), { recursive: true });
    await fs.writeFile(HERO_ASSET_FILE, bytes);
    document = document.split(duplicatedHero).join(`/${HERO_ASSET_RELATIVE}`);
    changed = true;
  } else if (!(await exists(HERO_ASSET_FILE))) {
    throw new Error('Homepage hero is neither embedded twice nor available as the expected external asset.');
  }

  const fontImport = document.match(/@import\s+url\((['"]?)(https:\/\/fonts\.googleapis\.com\/css2\?[^)'";]+)\1\);?/i);
  if (fontImport) {
    const fontUrl = fontImport[2].replace(/&amp;/g, '&');
    document = document.replace(fontImport[0], '');
    const links = [
      '<link rel="preconnect" href="https://fonts.googleapis.com">',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      `<link rel="stylesheet" href="${fontUrl.replace(/&/g, '&amp;')}">`
    ].join('\n');
    document = document.replace(/<style\b/i, `${links}\n<style`);
    changed = true;
  }

  if (document.includes('data:image/webp;base64,') && duplicatedHero && document.includes(duplicatedHero)) {
    throw new Error('Homepage hero data URI replacement was incomplete.');
  }

  if (changed) await fs.writeFile(INDEX_FILE, document);
  return changed;
}

async function optimizeCollectionPages() {
  const files = (await walk(path.join(ROOT, 'collections'))).filter(file => file.endsWith('index.html'));
  let changed = 0;
  let inspected = 0;

  for (const file of files) {
    const original = await fs.readFile(file, 'utf8');
    if (!original.includes('<section class="product-grid"')) continue;
    inspected += 1;
    const result = prioritizeFirstImageAfter(original, '<section class="product-grid"');
    if (result.changed) {
      await fs.writeFile(file, result.document);
      changed += 1;
    }
  }

  if (!inspected) throw new Error('No generated collection product grids were found.');
  return { inspected, changed };
}

async function optimizeDiscontinuedPages() {
  const files = (await walk(path.join(ROOT, 'products'))).filter(file => file.endsWith('index.html'));
  let inspected = 0;
  let changed = 0;

  for (const file of files) {
    const original = await fs.readFile(file, 'utf8');
    if (!original.includes('<section class="unavailable-panel"')) continue;
    inspected += 1;
    const result = prioritizeFirstImageAfter(original, '<section class="unavailable-panel"');
    if (result.changed) {
      await fs.writeFile(file, result.document);
      changed += 1;
    }
  }

  return { inspected, changed };
}

async function main() {
  const homepageChanged = await optimizeHomepage();
  const collections = await optimizeCollectionPages();
  const discontinued = await optimizeDiscontinuedPages();

  console.log(JSON.stringify({
    ok: true,
    homepageChanged,
    heroAsset: HERO_ASSET_RELATIVE,
    collectionPagesInspected: collections.inspected,
    collectionPagesChanged: collections.changed,
    discontinuedPagesInspected: discontinued.inspected,
    discontinuedPagesChanged: discontinued.changed
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
