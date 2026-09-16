import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SHOPIFY_HOST = 'cdn.shopify.com';

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

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getAttr(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match ? match[2] : null;
}

function hasAttr(tag, name) {
  return new RegExp(`\\s${name}(?:\\s*=|\\s|>)`, 'i').test(tag);
}

function setAttr(tag, name, value) {
  const expression = new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  const replacement = ` ${name}="${escapeAttr(value)}"`;
  if (expression.test(tag)) return tag.replace(expression, replacement);
  return tag.replace(/>$/, `${replacement}>`);
}

function normalizeImageUrl(value) {
  const source = decodeHtml(value);
  try {
    const url = new URL(source);
    url.searchParams.delete('width');
    return url.href;
  } catch {
    return source;
  }
}

function shopifyVariant(value, width) {
  const source = decodeHtml(value);
  try {
    const url = new URL(source);
    if (url.hostname !== SHOPIFY_HOST) return null;
    url.searchParams.set('width', String(width));
    return url.href;
  } catch {
    return null;
  }
}

function responsiveTag(tag, { widths, sizes }) {
  const src = getAttr(tag, 'src');
  if (!src) throw new Error('Image tag is missing src.');

  let updated = tag;
  const variants = widths.map(width => [width, shopifyVariant(src, width)]).filter(([, url]) => url);
  if (variants.length === widths.length && !hasAttr(updated, 'srcset')) {
    updated = setAttr(updated, 'srcset', variants.map(([width, url]) => `${url} ${width}w`).join(', '));
  }
  if (variants.length === widths.length && !hasAttr(updated, 'sizes')) {
    updated = setAttr(updated, 'sizes', sizes);
  }
  if (!hasAttr(updated, 'decoding')) updated = setAttr(updated, 'decoding', 'async');
  return updated;
}

function validateMeaningfulImage(tag, context) {
  const alt = getAttr(tag, 'alt');
  if (alt == null) throw new Error(`${context}: image is missing alt.`);
  if (!decodeHtml(alt).trim()) throw new Error(`${context}: meaningful image has empty alt.`);
  if (decodeHtml(alt).trim().length > 220) throw new Error(`${context}: image alt is unexpectedly long.`);

  const width = Number(getAttr(tag, 'width'));
  const height = Number(getAttr(tag, 'height'));
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error(`${context}: image is missing valid width/height attributes.`);
  }

  const src = getAttr(tag, 'src');
  if (!src) throw new Error(`${context}: image is missing src.`);
  if (decodeHtml(src).includes(SHOPIFY_HOST)) {
    if (!getAttr(tag, 'srcset')) throw new Error(`${context}: Shopify image is missing responsive srcset.`);
    if (!getAttr(tag, 'sizes')) throw new Error(`${context}: Shopify image is missing sizes.`);
  }
  if (getAttr(tag, 'decoding') !== 'async') throw new Error(`${context}: image is missing decoding=async.`);
}

function jsonLdBlocks(document) {
  const blocks = [];
  for (const match of document.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch (error) {
      throw new Error(`Invalid JSON-LD encountered during image SEO validation: ${error.message}`);
    }
  }
  return blocks;
}

function firstImageAfter(document, marker) {
  const markerIndex = document.indexOf(marker);
  if (markerIndex < 0) return null;
  const match = document.slice(markerIndex).match(/<img\b[^>]*>/i);
  return match?.[0] || null;
}

function metaContent(document, property) {
  const match = document.match(new RegExp(`<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`, 'i'));
  return match?.[1] || null;
}

function verifyProductImageConsistency(document, relative) {
  const product = jsonLdBlocks(document).find(block => block?.['@type'] === 'Product');
  if (!product) throw new Error(`${relative}: active product page is missing Product JSON-LD.`);

  const schemaImage = Array.isArray(product.image) ? product.image[0] : product.image;
  const ogImage = metaContent(document, 'og:image');
  const visible = firstImageAfter(document, '<div class="product-images">');
  const visibleSrc = visible && getAttr(visible, 'src');

  if (!schemaImage || !ogImage || !visibleSrc) throw new Error(`${relative}: missing preferred product image reference.`);

  const expected = normalizeImageUrl(schemaImage);
  if (normalizeImageUrl(ogImage) !== expected) throw new Error(`${relative}: og:image does not match Product image[0].`);
  if (normalizeImageUrl(visibleSrc) !== expected) throw new Error(`${relative}: visible primary image does not match Product image[0].`);
}

function optimizeProductDocument(document, relative, counters) {
  const marker = '<div class="product-images">';
  const markerIndex = document.indexOf(marker);
  if (markerIndex < 0) throw new Error(`${relative}: active product page is missing product image gallery.`);

  const beforeCount = (document.match(/<img\b/gi) || []).length;
  let imageIndex = 0;
  const updated = document.replace(/<img\b[^>]*>/gi, tag => {
    let result = responsiveTag(tag, {
      widths: [520, 800, 1100],
      sizes: '(max-width:800px) calc(100vw - 2rem), 50vw'
    });
    if (imageIndex === 0) {
      result = setAttr(result, 'loading', 'eager');
      result = setAttr(result, 'fetchpriority', 'high');
    } else {
      result = setAttr(result, 'loading', 'lazy');
    }
    validateMeaningfulImage(result, `${relative} image ${imageIndex + 1}`);
    imageIndex += 1;
    return result;
  });

  const afterCount = (updated.match(/<img\b/gi) || []).length;
  if (beforeCount !== afterCount || imageIndex === 0) throw new Error(`${relative}: image count changed unexpectedly.`);

  verifyProductImageConsistency(updated, relative);
  counters.productImages += imageIndex;
  return updated;
}

function optimizeCollectionDocument(document, relative, counters) {
  const gridMarker = '<section class="product-grid"';
  const gridIndex = document.indexOf(gridMarker);
  if (gridIndex < 0) return document;

  const beforeCount = (document.match(/<img\b/gi) || []).length;
  let imageIndex = 0;
  const updated = document.replace(/<img\b[^>]*>/gi, tag => {
    let result = responsiveTag(tag, {
      widths: [360, 520, 800],
      sizes: '(max-width:380px) calc(100vw - 2rem), (max-width:800px) 50vw, 25vw'
    });
    if (imageIndex === 0) {
      if (getAttr(result, 'loading') !== 'eager' || getAttr(result, 'fetchpriority') !== 'high') {
        throw new Error(`${relative}: first collection image lost its accepted eager/high priority.`);
      }
    } else if (getAttr(result, 'loading') !== 'lazy') {
      throw new Error(`${relative}: non-critical collection image is not lazy-loaded.`);
    }
    validateMeaningfulImage(result, `${relative} card image ${imageIndex + 1}`);
    imageIndex += 1;
    return result;
  });

  const afterCount = (updated.match(/<img\b/gi) || []).length;
  if (beforeCount !== afterCount || imageIndex === 0) throw new Error(`${relative}: collection image count changed unexpectedly.`);

  const ogImage = metaContent(updated, 'og:image');
  const visible = firstImageAfter(updated, gridMarker);
  if (!ogImage || !visible || normalizeImageUrl(getAttr(visible, 'src')) !== normalizeImageUrl(ogImage)) {
    throw new Error(`${relative}: collection preferred image is inconsistent with the first visible product image.`);
  }

  counters.collectionImages += imageIndex;
  return updated;
}

async function auditHomepage() {
  const document = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
  const tags = [...document.matchAll(/<img\b[^>]*>/gi)].map(match => match[0]);
  if (!tags.length) throw new Error('Homepage image audit found no images.');

  for (const [index, tag] of tags.entries()) {
    const alt = getAttr(tag, 'alt');
    if (alt == null) throw new Error(`Homepage image ${index + 1} is missing alt.`);
    if (!decodeHtml(alt).trim() && getAttr(tag, 'aria-hidden') !== 'true') {
      throw new Error(`Homepage image ${index + 1} has empty alt without aria-hidden=true.`);
    }
  }

  const hero = tags.find(tag => /class=["'][^"']*hero-image/.test(tag));
  if (!hero) throw new Error('Homepage hero image was not found.');
  if (!decodeHtml(getAttr(hero, 'alt')).trim()) throw new Error('Homepage hero image requires meaningful alt text.');
  if (getAttr(hero, 'fetchpriority') !== 'high') throw new Error('Homepage hero image lost fetchpriority=high.');
  if (!decodeHtml(getAttr(hero, 'src')).endsWith('.webp')) throw new Error('Homepage hero is no longer served as the accepted WebP asset.');
  if (!/max-image-preview:large/i.test(document)) throw new Error('Homepage lost max-image-preview:large.');

  return tags.length;
}

async function auditDynamicCatalogueRuntime() {
  const runtime = await fs.readFile(path.join(ROOT, 'dawood-catalogue.js'), 'utf8');
  const css = await fs.readFile(path.join(ROOT, 'dawood-catalogue.css'), 'utf8');
  for (const required of ['srcset=', 'sizes=', 'alt=', 'loading=', 'fetchpriority="high"']) {
    if (!runtime.includes(required)) throw new Error(`Dynamic catalogue runtime is missing ${required}.`);
  }
  if (!css.includes('aspect-ratio:3/4') || !css.includes('aspect-ratio:4/5')) {
    throw new Error('Dynamic catalogue image slots no longer reserve the accepted product/collection aspect ratios.');
  }
}

async function main() {
  const counters = {
    activeProductPages: 0,
    collectionPages: 0,
    productImages: 0,
    collectionImages: 0,
    changedFiles: 0
  };

  const productFiles = (await walk(path.join(ROOT, 'products'))).filter(file => file.endsWith('index.html'));
  for (const file of productFiles) {
    const original = await fs.readFile(file, 'utf8');
    if (!original.includes('"@type":"Product"')) continue;
    const relative = path.relative(ROOT, file).replaceAll(path.sep, '/');
    const updated = optimizeProductDocument(original, relative, counters);
    counters.activeProductPages += 1;
    if (updated !== original) {
      await fs.writeFile(file, updated);
      counters.changedFiles += 1;
    }
  }

  const collectionFiles = (await walk(path.join(ROOT, 'collections'))).filter(file => file.endsWith('index.html'));
  for (const file of collectionFiles) {
    const original = await fs.readFile(file, 'utf8');
    if (!original.includes('<section class="product-grid"')) continue;
    const relative = path.relative(ROOT, file).replaceAll(path.sep, '/');
    const updated = optimizeCollectionDocument(original, relative, counters);
    counters.collectionPages += 1;
    if (updated !== original) {
      await fs.writeFile(file, updated);
      counters.changedFiles += 1;
    }
  }

  if (!counters.activeProductPages) throw new Error('Image SEO postprocessor found no active product pages.');
  if (!counters.collectionPages) throw new Error('Image SEO postprocessor found no active collection pages.');

  const homepageImages = await auditHomepage();
  await auditDynamicCatalogueRuntime();

  console.log(JSON.stringify({
    ok: true,
    ...counters,
    homepageImages,
    dynamicCatalogueResponsiveImages: true,
    imageSitemapAdded: false,
    imageSitemapReason: 'Active product images are already discoverable in standard HTML and Product structured data; externally hosted Shopify CDN images remain under third-party hosting control.'
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
