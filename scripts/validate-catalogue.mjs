import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE = 'https://alhumacollection.com';
const PAGE_SIZE = 48;
const REPORT_FILE = path.join(ROOT, 'catalogue/validation-report.json');
const BRAND_ALIASES = new Map([
  ['anaya noor', 'Anaya Noor'],
  ['lime light', 'Limelight'],
  ['limelight', 'Limelight']
]);

const cleanText = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const slugify = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'design';
const productPath = item => `products/${slugify(item.code)}-${slugify(item.productName || item.name)}/`;
const absolute = relative => `${BASE}/${relative.replace(/^\//, '')}`;
const canonicalBrand = value => BRAND_ALIASES.get(cleanText(value).toLowerCase()) || cleanText(value);

async function readJson(relative) {
  return JSON.parse(await fs.readFile(path.join(ROOT, relative), 'utf8'));
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(item => item.some(value => value !== ''));
}

const duplicates = values => [...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map())].filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));

async function exists(relative) {
  try { await fs.access(path.join(ROOT, relative)); return true; } catch { return false; }
}

async function main() {
  const errors = [];
  const warnings = [];
  const catalogue = await readJson('catalogue/dawood-products.json');
  const registry = await readJson('catalogue/brand-slugs.json');
  const products = Array.isArray(catalogue.products) ? catalogue.products : [];
  if (products.length < 20) errors.push(`Catalogue contains only ${products.length} products.`);

  const duplicateIds = duplicates(products.map(item => item.id));
  const duplicateCodes = duplicates(products.map(item => item.code));
  const duplicateProductPaths = duplicates(products.map(productPath));
  if (duplicateIds.length) errors.push(`${duplicateIds.length} duplicate product IDs detected.`);
  if (duplicateProductPaths.length) errors.push(`${duplicateProductPaths.length} duplicate canonical product paths detected.`);
  if (duplicateCodes.length) warnings.push(`${duplicateCodes.length} duplicate SKUs detected; review required.`);

  const remainingAliases = products.filter(item => canonicalBrand(item.brand) !== item.brand);
  if (remainingAliases.length) errors.push(`${remainingAliases.length} products still use non-canonical brand aliases.`);

  const missingImages = products.filter(item => !item.image);
  if (missingImages.length) errors.push(`${missingImages.length} products have no primary image.`);
  const invalidPrices = products.filter(item => item.price != null && (!Number.isFinite(item.price) || item.price <= 0));
  if (invalidPrices.length) errors.push(`${invalidPrices.length} products have invalid calculated prices.`);
  const categoryConflicts = products.filter(item => /\bluxury\b/i.test(`${item.name} ${item.sourceCollection}`) && item.category === 'Formal');
  if (categoryConflicts.length) warnings.push(`${categoryConflicts.length} products contain “Luxury” but inherit the Formal supplier section.`);
  const missingDescriptions = products.filter(item => !cleanText(item.sourceDescription));
  if (missingDescriptions.length) warnings.push(`${missingDescriptions.length} products currently lack retained supplier description text.`);

  const activeSlugs = Object.values(registry.brands || {});
  const duplicateSlugs = duplicates(activeSlugs);
  if (duplicateSlugs.length) errors.push(`${duplicateSlugs.length} duplicate active collection slugs detected.`);
  for (const [alias, target] of Object.entries(registry.redirects || {})) {
    if (activeSlugs.includes(alias)) errors.push(`Redirect alias ${alias} conflicts with an active collection slug.`);
    if (!activeSlugs.includes(target)) errors.push(`Redirect target ${target} is not an active collection slug.`);
  }

  const sitemapText = await fs.readFile(path.join(ROOT, 'catalogue/products-sitemap.xml'), 'utf8');
  if (/<priority>|<changefreq>/i.test(sitemapText)) errors.push('Sitemap still contains ignored priority or changefreq elements.');
  const sitemapUrls = [...sitemapText.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1].replace(/&amp;/g, '&'));
  const duplicateSitemapUrls = duplicates(sitemapUrls);
  if (duplicateSitemapUrls.length) errors.push(`${duplicateSitemapUrls.length} duplicate sitemap URLs detected.`);

  const expectedProductUrls = products.map(item => absolute(productPath(item)));
  const missingProductUrls = expectedProductUrls.filter(url => !sitemapUrls.includes(url));
  if (missingProductUrls.length) errors.push(`${missingProductUrls.length} canonical product URLs are absent from the sitemap.`);

  const brands = [...new Set(products.map(item => item.brand))];
  let expectedCollectionPages = 0;
  for (const brand of brands) {
    const slug = registry.brands?.[brand];
    if (!slug) { errors.push(`No stable collection slug registered for ${brand}.`); continue; }
    const count = products.filter(item => item.brand === brand).length;
    const pages = Math.ceil(count / PAGE_SIZE);
    expectedCollectionPages += pages;
    for (let page = 1; page <= pages; page += 1) {
      const relative = page === 1 ? `collections/${slug}/` : `collections/${slug}/page/${page}/`;
      if (!sitemapUrls.includes(absolute(relative))) errors.push(`Collection page missing from sitemap: ${relative}`);
      if (!await exists(`${relative}index.html`)) errors.push(`Generated collection file missing: ${relative}index.html`);
    }
  }

  let missingProductFiles = 0;
  for (const product of products) if (!await exists(`${productPath(product)}index.html`)) missingProductFiles += 1;
  if (missingProductFiles) errors.push(`${missingProductFiles} generated product files are missing.`);

  const csvRows = parseCsv(await fs.readFile(path.join(ROOT, 'catalogue/meta-product-feed.csv'), 'utf8'));
  const headers = csvRows[0] || [];
  const linkIndex = headers.indexOf('link');
  const idIndex = headers.indexOf('id');
  if (linkIndex < 0 || idIndex < 0) errors.push('Meta feed is missing id or link columns.');
  const feedRows = csvRows.slice(1);
  const expectedFeedProducts = products.filter(item => Number.isFinite(item.price) && item.price > 0);
  if (feedRows.length !== expectedFeedProducts.length) errors.push(`Meta feed has ${feedRows.length} rows; expected ${expectedFeedProducts.length}.`);
  const invalidFeedLinks = linkIndex < 0 ? [] : feedRows.filter(row => !String(row[linkIndex] || '').startsWith(`${BASE}/products/`));
  if (invalidFeedLinks.length) errors.push(`${invalidFeedLinks.length} Meta feed links do not use canonical product pages.`);
  if (idIndex >= 0) {
    const duplicateFeedIds = duplicates(feedRows.map(row => row[idIndex]));
    if (duplicateFeedIds.length) errors.push(`${duplicateFeedIds.length} duplicate product IDs exist in the Meta feed.`);
  }

  const report = {
    ok: errors.length === 0,
    generatedAt: new Date().toISOString(),
    summary: {
      products: products.length,
      brands: brands.length,
      collectionPages: expectedCollectionPages,
      sitemapUrls: sitemapUrls.length,
      metaFeedRows: feedRows.length,
      errors: errors.length,
      warnings: warnings.length
    },
    errors,
    warnings,
    samples: {
      duplicateCodes: duplicateCodes.slice(0, 25),
      categoryConflicts: categoryConflicts.slice(0, 25).map(item => ({ code: item.code, name: item.name, category: item.category })),
      missingDescriptions: missingDescriptions.slice(0, 25).map(item => item.code)
    }
  };
  await fs.writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  if (errors.length) throw new Error(`Catalogue validation failed with ${errors.length} error(s). See catalogue/validation-report.json.`);
  console.log(`Catalogue validation passed with ${warnings.length} warning(s).`);
}

main().catch(async error => {
  console.error(error);
  process.exitCode = 1;
});
