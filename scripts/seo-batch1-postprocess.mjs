import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'catalogue/dawood-products.json');
const STATUS_FILE = path.join(ROOT, 'catalogue/sync-status.json');
const FEED_FILE = path.join(ROOT, 'catalogue/meta-product-feed.csv');
const REPORT_FILE = path.join(ROOT, 'catalogue/source-integrity-report.json');
const HISTORY_FILE = path.join(ROOT, 'catalogue/product-history.json');
const REMOVED_FILE = path.join(ROOT, 'catalogue/removed-products.json');
const BASE = 'https://alhumacollection.com';
const BRAND_ALIASES = new Map([
  ['anaya noor', 'Anaya Noor'],
  ['lime light', 'Limelight'],
  ['limelight', 'Limelight']
]);

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const canonicalBrand = value => BRAND_ALIASES.get(clean(value).toLowerCase()) || clean(value) || 'Other designs';
const slugify = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'design';
const productPath = item => clean(item.path) || `products/${slugify(item.code)}-${slugify(item.productName || item.name)}/`;
const csv = value => `"${String(value ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`;
const duplicateValues = values => [...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map())].filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

function historyRecord(item, previous = {}) {
  const now = new Date().toISOString();
  return {
    code: item.code,
    id: item.id,
    name: item.name,
    productName: item.productName || item.name,
    brand: item.brand,
    sourceBrand: item.sourceBrand || item.brand,
    category: item.category,
    pieceType: item.pieceType,
    pricingClass: item.pricingClass,
    price: item.price,
    image: item.image,
    images: Array.isArray(item.images) ? item.images : [],
    path: productPath(item),
    firstSeenAt: previous.firstSeenAt || item.createdAt || item.updatedAt || now,
    lastSeenAt: item.updatedAt || now
  };
}

async function main() {
  const catalogue = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  const status = await readJson(STATUS_FILE, { ok: true });
  const history = await readJson(HISTORY_FILE, { schemaVersion: 1, products: {} });
  const removedRegistry = await readJson(REMOVED_FILE, { schemaVersion: 1, products: [] });
  const rawProducts = Array.isArray(catalogue.products) ? catalogue.products : [];
  if (rawProducts.length < 20) throw new Error(`Post-processing refused: only ${rawProducts.length} products found.`);

  const aliasCorrections = [];
  const products = rawProducts.map(item => {
    const sourceBrand = clean(item.sourceBrand || item.brand);
    const brand = canonicalBrand(item.brand);
    if (brand !== item.brand) aliasCorrections.push({ code: item.code, sourceBrand: item.brand, canonicalBrand: brand });
    return { ...item, sourceBrand, brand };
  }).sort((a, b) => Number(b.available) - Number(a.available) || a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));

  const counts = {
    products: products.length,
    available: products.filter(item => item.available).length,
    formal: products.filter(item => item.category === 'Formal').length,
    luxury: products.filter(item => item.category === 'Luxury').length,
    priceOnEnquiry: products.filter(item => item.price == null).length,
    metaFeedProducts: products.filter(item => Number.isFinite(item.price) && item.price > 0).length
  };
  await fs.writeFile(DATA_FILE, `${JSON.stringify({ ...catalogue, schemaVersion: Math.max(2, Number(catalogue.schemaVersion) || 1), counts, products }, null, 2)}\n`);

  const activeCodes = new Set(products.map(item => item.code));
  const nextHistory = { ...(history.products || {}) };
  const removedByCode = new Map((removedRegistry.products || []).filter(item => item?.code).map(item => [item.code, item]));
  const removedNow = [];

  if (status.ok !== false) {
    for (const prior of Object.values(history.products || {})) {
      if (!prior?.code || activeCodes.has(prior.code)) continue;
      const existing = removedByCode.get(prior.code);
      const removed = {
        ...prior,
        removedAt: existing?.removedAt || new Date().toISOString(),
        reason: existing?.reason || 'supplier-removed'
      };
      removedByCode.set(prior.code, removed);
      if (!existing) removedNow.push(removed);
    }
  }

  for (const item of products) {
    nextHistory[item.code] = historyRecord(item, nextHistory[item.code]);
    removedByCode.delete(item.code);
  }

  const removedProducts = [...removedByCode.values()].sort((a, b) => clean(a.brand).localeCompare(clean(b.brand)) || clean(a.name).localeCompare(clean(b.name)) || clean(a.code).localeCompare(clean(b.code)));
  await fs.writeFile(HISTORY_FILE, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), products: nextHistory }, null, 2)}\n`);
  await fs.writeFile(REMOVED_FILE, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), products: removedProducts }, null, 2)}\n`);

  const nameCounts = products.reduce((map, item) => {
    const key = clean(item.name).toLowerCase();
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
  const feedTitle = item => nameCounts.get(clean(item.name).toLowerCase()) > 1 ? `${item.name} — ${item.code}` : item.name;

  const headers = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand', 'product_type'];
  const rows = products.filter(item => Number.isFinite(item.price) && item.price > 0).map(item => [
    item.code,
    feedTitle(item),
    `${feedTitle(item)}. ${item.pieceType} unstitched suit by ${item.brand}. Cash on Delivery in Pakistan. Availability is confirmed before dispatch.`,
    item.available ? 'in stock' : 'out of stock',
    'new',
    `${Number(item.price).toFixed(2)} PKR`,
    `${BASE}/${productPath(item)}`,
    item.image,
    item.brand,
    `Women > Unstitched Suits > ${item.category}`
  ].map(csv).join(','));
  if (rows.length !== counts.metaFeedProducts) throw new Error('Meta feed row count does not match the normalized catalogue.');
  await fs.writeFile(FEED_FILE, `${headers.map(csv).join(',')}\n${rows.join('\n')}\n`);

  const duplicateCodes = duplicateValues(products.map(item => item.code));
  const duplicatePaths = duplicateValues(products.map(productPath));
  const classificationConflicts = products.filter(item => /\bluxury\b/i.test(`${item.name} ${item.sourceCollection}`) && item.category === 'Formal').map(item => ({ code: item.code, name: item.name, category: item.category }));
  const duplicateNames = duplicateValues(products.map(item => clean(item.name).toLowerCase()));
  const report = {
    ok: duplicatePaths.length === 0,
    generatedAt: new Date().toISOString(),
    summary: {
      ...counts,
      canonicalBrands: new Set(products.map(item => item.brand)).size,
      aliasCorrections: aliasCorrections.length,
      duplicateCodes: duplicateCodes.length,
      duplicatePaths: duplicatePaths.length,
      duplicateNames: duplicateNames.length,
      classificationConflicts: classificationConflicts.length,
      unspecifiedPieces: products.filter(item => item.pieceType === 'Unspecified').length,
      removedProducts: removedProducts.length,
      newlyRemovedProducts: removedNow.length,
      supplierRefreshUsed: status.ok !== false
    },
    aliasCorrections: aliasCorrections.slice(0, 250),
    duplicateCodes,
    duplicatePaths,
    duplicateNames,
    classificationConflicts: classificationConflicts.slice(0, 500),
    newlyRemovedProducts: removedNow.slice(0, 100).map(item => ({ code: item.code, name: item.name, path: item.path }))
  };
  await fs.writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  if (duplicatePaths.length) throw new Error(`Post-processing found ${duplicatePaths.length} duplicate canonical product paths.`);
  console.log(`Normalized ${products.length} products, retained ${removedProducts.length} removed-product records and generated ${rows.length} canonical Meta feed rows.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
