import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'catalogue/dawood-products.json');
const FEED_FILE = path.join(ROOT, 'catalogue/meta-product-feed.csv');
const REPORT_FILE = path.join(ROOT, 'catalogue/source-integrity-report.json');
const BASE = 'https://alhumacollection.com';
const BRAND_ALIASES = new Map([
  ['anaya noor', 'Anaya Noor'],
  ['lime light', 'Limelight'],
  ['limelight', 'Limelight']
]);

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const canonicalBrand = value => BRAND_ALIASES.get(clean(value).toLowerCase()) || clean(value) || 'Other designs';
const slugify = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'design';
const productPath = item => `products/${slugify(item.code)}-${slugify(item.productName || item.name)}/`;
const csv = value => `"${String(value ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`;
const duplicateValues = values => [...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map())].filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));

async function main() {
  const catalogue = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
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

  const headers = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand', 'product_type'];
  const rows = products.filter(item => Number.isFinite(item.price) && item.price > 0).map(item => [
    item.code,
    item.name,
    `${item.name}. ${item.pieceType} unstitched suit by ${item.brand}. Cash on Delivery in Pakistan. Availability is confirmed before dispatch.`,
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
  const report = {
    ok: duplicatePaths.length === 0,
    generatedAt: new Date().toISOString(),
    summary: {
      ...counts,
      canonicalBrands: new Set(products.map(item => item.brand)).size,
      aliasCorrections: aliasCorrections.length,
      duplicateCodes: duplicateCodes.length,
      duplicatePaths: duplicatePaths.length,
      classificationConflicts: classificationConflicts.length,
      unspecifiedPieces: products.filter(item => item.pieceType === 'Unspecified').length
    },
    aliasCorrections: aliasCorrections.slice(0, 250),
    duplicateCodes,
    duplicatePaths,
    classificationConflicts: classificationConflicts.slice(0, 500)
  };
  await fs.writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  if (duplicatePaths.length) throw new Error(`Post-processing found ${duplicatePaths.length} duplicate canonical product paths.`);
  console.log(`Normalized ${products.length} products and generated ${rows.length} canonical Meta feed rows.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
