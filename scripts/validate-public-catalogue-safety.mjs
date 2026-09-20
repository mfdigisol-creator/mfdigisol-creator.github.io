import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PUBLIC_CATALOGUE = 'catalogue/products.json';

const TOP_LEVEL_ALLOWED = new Set(['schemaVersion', 'synchronizedAt', 'counts', 'products']);
const COUNTS_ALLOWED = new Set(['products', 'available', 'formal', 'luxury', 'priceOnEnquiry', 'metaFeedProducts']);
const PRODUCT_ALLOWED = new Set([
  'code','name','productName','brand','category','price','pricingClass','pieceType',
  'description','currency','available','image','images','updatedAt'
]);
const HISTORY_ALLOWED = new Set([
  'code','name','productName','brand','category','pieceType','pricingClass','price',
  'image','images','path','firstSeenAt','lastSeenAt'
]);
const REMOVED_ALLOWED = new Set([...HISTORY_ALLOWED, 'removedAt']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertAllowedKeys(object, allowed, label) {
  for (const key of Object.keys(object || {})) {
    assert(allowed.has(key), `${label}: unexpected public key "${key}"`);
  }
}

async function read(relative) {
  return JSON.parse(await fs.readFile(path.join(ROOT, relative), 'utf8'));
}

function validateCatalogue(payload, label) {
  assertAllowedKeys(payload, TOP_LEVEL_ALLOWED, label);
  assertAllowedKeys(payload.counts, COUNTS_ALLOWED, `${label}.counts`);
  assert(payload.schemaVersion === 3, `${label}: schemaVersion must be 3`);
  assert(Number.isFinite(Date.parse(payload.synchronizedAt)), `${label}: invalid synchronizedAt`);
  assert(Array.isArray(payload.products) && payload.products.length >= 20, `${label}: product list is unexpectedly small`);

  const codes = new Set();
  for (const [index, product] of payload.products.entries()) {
    const productLabel = `${label}.products[${index}]`;
    assertAllowedKeys(product, PRODUCT_ALLOWED, productLabel);
    assert(typeof product.code === 'string' && product.code, `${productLabel}: code missing`);
    assert(!codes.has(product.code), `${productLabel}: duplicate product code ${product.code}`);
    codes.add(product.code);
    assert(typeof product.name === 'string' && product.name, `${productLabel}: name missing`);
    assert(typeof product.brand === 'string' && product.brand, `${productLabel}: brand missing`);
    assert(['Formal','Luxury'].includes(product.category), `${productLabel}: invalid category`);
    assert(product.price === null || (Number.isFinite(product.price) && product.price > 0), `${productLabel}: invalid retail price`);
    assert(['embroidered','non-embroidered','unknown'].includes(product.pricingClass), `${productLabel}: invalid pricingClass`);
    assert(product.currency === 'PKR', `${productLabel}: currency must be PKR`);
    assert(typeof product.available === 'boolean', `${productLabel}: availability must be boolean`);
    assert(typeof product.image === 'string' && product.image, `${productLabel}: image missing`);
    assert(Array.isArray(product.images), `${productLabel}: images must be an array`);
  }

  const computed = {
    products: payload.products.length,
    available: payload.products.filter(item => item.available).length,
    formal: payload.products.filter(item => item.category === 'Formal').length,
    luxury: payload.products.filter(item => item.category === 'Luxury').length,
    priceOnEnquiry: payload.products.filter(item => item.price === null).length,
    metaFeedProducts: payload.products.filter(item => Number.isFinite(item.price) && item.price > 0).length
  };
  assert(JSON.stringify(computed) === JSON.stringify(payload.counts), `${label}: aggregate counts mismatch`);
}

function validateRegistry(payload, allowed, label, collection) {
  const products = collection === 'object' ? Object.values(payload.products || {}) : (payload.products || []);
  for (const [index, item] of products.entries()) {
    assertAllowedKeys(item, allowed, `${label}.products[${index}]`);
  }
}

async function main() {
  const catalogue = await read(PUBLIC_CATALOGUE);
  validateCatalogue(catalogue, PUBLIC_CATALOGUE);

  const history = await read('catalogue/product-history.json');
  const removed = await read('catalogue/removed-products.json');
  validateRegistry(history, HISTORY_ALLOWED, 'catalogue/product-history.json', 'object');
  validateRegistry(removed, REMOVED_ALLOWED, 'catalogue/removed-products.json', 'array');

  for (const relative of [
    'catalogue/analytics-measurement-report.json',
    'catalogue/search-ecosystem-consistency-report.json',
    'catalogue/seo-generation-report.json',
    'catalogue/source-integrity-report.json',
    'catalogue/validation-report.json'
  ]) {
    try {
      await fs.access(path.join(ROOT, relative));
      throw new Error(`${relative}: diagnostic artifact must not be published`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  console.log(JSON.stringify({
    ok: true,
    products: catalogue.products.length,
    productFields: [...PRODUCT_ALLOWED],
    historicalFields: [...HISTORY_ALLOWED],
    removedFields: [...REMOVED_ALLOWED]
  }, null, 2));
}

await main();
