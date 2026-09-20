import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const LEGACY_CATALOGUE = path.join(ROOT, 'catalogue/dawood-products.json');
const PUBLIC_CATALOGUE = path.join(ROOT, 'catalogue/products.json');
const HISTORY_FILE = path.join(ROOT, 'catalogue/product-history.json');
const REMOVED_FILE = path.join(ROOT, 'catalogue/removed-products.json');

const DIAGNOSTIC_FILES = [
  'catalogue/analytics-measurement-report.json',
  'catalogue/search-ecosystem-consistency-report.json',
  'catalogue/seo-generation-report.json',
  'catalogue/source-integrity-report.json',
  'catalogue/validation-report.json'
];

const PRODUCT_KEYS = Object.freeze([
  'code',
  'name',
  'productName',
  'brand',
  'category',
  'price',
  'pricingClass',
  'pieceType',
  'description',
  'currency',
  'available',
  'image',
  'images',
  'updatedAt'
]);

const HISTORY_KEYS = Object.freeze([
  'code',
  'name',
  'productName',
  'brand',
  'category',
  'pieceType',
  'pricingClass',
  'price',
  'image',
  'images',
  'path',
  'firstSeenAt',
  'lastSeenAt'
]);

const REMOVED_KEYS = Object.freeze([...HISTORY_KEYS, 'removedAt']);

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();

function pick(source, keys) {
  return Object.fromEntries(keys.filter(key => Object.hasOwn(source || {}, key)).map(key => [key, source[key]]));
}

function customerDescription(item) {
  return clean(item?.description || item?.sourceDescription || '') || null;
}

function publicProduct(item) {
  const product = {
    code: clean(item.code),
    name: clean(item.name),
    productName: clean(item.productName || item.name),
    brand: clean(item.brand),
    category: clean(item.category),
    price: Number.isFinite(item.price) ? item.price : null,
    pricingClass: ['embroidered', 'non-embroidered'].includes(item.pricingClass) ? item.pricingClass : 'unknown',
    pieceType: clean(item.pieceType) || 'Unspecified',
    description: customerDescription(item),
    currency: item.currency === 'PKR' ? 'PKR' : 'PKR',
    available: item.available === true,
    image: clean(item.image),
    images: Array.isArray(item.images) ? item.images.map(clean).filter(Boolean).slice(0, 6) : [],
    updatedAt: clean(item.updatedAt) || null
  };
  if (!product.code || !product.name || !product.brand || !product.category || !product.image) {
    throw new Error(`Unsafe/invalid product projection for ${product.code || 'unknown product'}`);
  }
  return product;
}

function counts(products) {
  return {
    products: products.length,
    available: products.filter(item => item.available).length,
    formal: products.filter(item => item.category === 'Formal').length,
    luxury: products.filter(item => item.category === 'Luxury').length,
    priceOnEnquiry: products.filter(item => item.price === null).length,
    metaFeedProducts: products.filter(item => Number.isFinite(item.price) && item.price > 0).length
  };
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function sanitizeRegistry(file, kind) {
  const payload = await readJson(file, null);
  if (!payload) return;
  if (kind === 'history') {
    const products = {};
    for (const [code, item] of Object.entries(payload.products || {})) {
      const safe = pick(item, HISTORY_KEYS);
      safe.code = clean(safe.code || code);
      if (!safe.code) continue;
      products[safe.code] = safe;
    }
    await writeJson(file, {
      schemaVersion: 2,
      generatedAt: payload.generatedAt || new Date().toISOString(),
      products
    });
    return;
  }
  const products = (Array.isArray(payload.products) ? payload.products : [])
    .map(item => pick(item, REMOVED_KEYS))
    .filter(item => clean(item.code));
  await writeJson(file, {
    schemaVersion: 2,
    generatedAt: payload.generatedAt || new Date().toISOString(),
    products
  });
}

async function main() {
  const source = await readJson(LEGACY_CATALOGUE, null);
  if (!source || !Array.isArray(source.products) || source.products.length < 20) {
    throw new Error('Customer-safe publication refused: catalogue is unavailable or unexpectedly small.');
  }

  const products = source.products.map(publicProduct);
  const synchronizedAt = clean(source.synchronizedAt);
  if (!synchronizedAt || !Number.isFinite(Date.parse(synchronizedAt))) {
    throw new Error('Customer-safe publication refused: synchronizedAt is invalid.');
  }

  const publicCatalogue = {
    schemaVersion: 3,
    synchronizedAt,
    counts: counts(products),
    products
  };

  // Neutral storefront/future-assistant path.
  await writeJson(PUBLIC_CATALOGUE, publicCatalogue);

  // Temporary compatibility path for the existing secure Orders catalogue importer.
  // Contents are identical to the neutral customer-safe projection.
  await writeJson(LEGACY_CATALOGUE, publicCatalogue);

  await sanitizeRegistry(HISTORY_FILE, 'history');
  await sanitizeRegistry(REMOVED_FILE, 'removed');

  for (const relative of DIAGNOSTIC_FILES) {
    await fs.rm(path.join(ROOT, relative), { force: true });
  }

  console.log(JSON.stringify({
    ok: true,
    schemaVersion: publicCatalogue.schemaVersion,
    products: products.length,
    fields: PRODUCT_KEYS,
    removedDiagnosticFiles: DIAGNOSTIC_FILES
  }, null, 2));
}

await main();
