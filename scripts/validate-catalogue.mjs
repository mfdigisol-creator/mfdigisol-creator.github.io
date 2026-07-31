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
const productPath = item => cleanText(item.path) || `products/${slugify(item.code)}-${slugify(item.productName || item.name)}/`;
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

async function listHtml(relative) {
  const start = path.join(ROOT, relative);
  const found = [];
  async function walk(directory) {
    let entries = [];
    try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith('.html')) found.push(path.relative(ROOT, full).replaceAll(path.sep, '/'));
    }
  }
  await walk(start);
  return found;
}

function extract(html, pattern) {
  return cleanText(html.match(pattern)?.[1] || '');
}

function productSchemaName(html) {
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(match[1].replace(/\\u003c/g, '<'));
      if (value?.['@type'] === 'Product') return cleanText(value.name);
    } catch { /* missing schema name is reported below */ }
  }
  return '';
}

function internalRoute(href) {
  if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) return null;
  try {
    const url = new URL(href, `${BASE}/`);
    if (url.origin !== BASE) return null;
    return decodeURI(url.pathname);
  } catch { return null; }
}

function routeFile(route) {
  if (route === '/') return 'index.html';
  const clean = route.replace(/^\//, '');
  if (route.endsWith('/')) return `${clean}index.html`;
  return clean;
}

async function main() {
  const errors = [];
  const warnings = [];
  const catalogue = await readJson('catalogue/dawood-products.json');
  const registry = await readJson('catalogue/brand-slugs.json');
  const removedRegistry = await readJson('catalogue/removed-products.json');
  const hostPolicy = await readJson('catalogue/host-canonical-policy.json');
  const products = Array.isArray(catalogue.products) ? catalogue.products : [];
  const removedProducts = Array.isArray(removedRegistry.products) ? removedRegistry.products : [];
  if (products.length < 20) errors.push(`Catalogue contains only ${products.length} products.`);
  if (hostPolicy.preferredOrigin !== BASE) errors.push('Host policy preferred origin does not match the canonical production origin.');

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
  const pagesSitemapText = await fs.readFile(path.join(ROOT, 'sitemap-pages.xml'), 'utf8');
  if (/<priority>|<changefreq>/i.test(`${sitemapText}\n${pagesSitemapText}`)) errors.push('A sitemap still contains ignored priority or changefreq elements.');
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

  const metadata = [];
  let missingProductFiles = 0;
  for (const product of products) {
    const relative = `${productPath(product)}index.html`;
    if (!await exists(relative)) { missingProductFiles += 1; continue; }
    const page = await fs.readFile(path.join(ROOT, relative), 'utf8');
    const canonical = extract(page, /<link rel="canonical" href="([^"]+)"/i);
    const title = extract(page, /<title>([\s\S]*?)<\/title>/i);
    const description = extract(page, /<meta name="description" content="([^"]*)"/i);
    const h1 = extract(page, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '');
    const schemaName = productSchemaName(page);
    const expectedCanonical = absolute(productPath(product));
    if (canonical !== expectedCanonical) errors.push(`Canonical mismatch for ${product.code}.`);
    if (!canonical.startsWith(`${BASE}/`) || canonical.includes('www.')) errors.push(`Non-preferred canonical host for ${product.code}.`);
    if (!title || !description || !h1 || !schemaName) errors.push(`Required metadata missing for ${product.code}.`);
    metadata.push({ code: product.code, title, description, h1, schemaName });
  }
  if (missingProductFiles) errors.push(`${missingProductFiles} generated product files are missing.`);

  const duplicateTitles = duplicates(metadata.map(item => item.title.toLowerCase()));
  const duplicateDescriptions = duplicates(metadata.map(item => item.description.toLowerCase()));
  const duplicateH1s = duplicates(metadata.map(item => item.h1.toLowerCase()));
  const duplicateSchemaNames = duplicates(metadata.map(item => item.schemaName.toLowerCase()));
  if (duplicateTitles.length) errors.push(`${duplicateTitles.length} duplicate indexable product titles detected.`);
  if (duplicateDescriptions.length) errors.push(`${duplicateDescriptions.length} duplicate indexable product descriptions detected.`);
  if (duplicateH1s.length) errors.push(`${duplicateH1s.length} duplicate indexable product H1 values detected.`);
  if (duplicateSchemaNames.length) errors.push(`${duplicateSchemaNames.length} duplicate Product schema names detected.`);

  const activeCodes = new Set(products.map(item => item.code));
  const duplicateRemovedCodes = duplicates(removedProducts.map(item => item.code));
  const duplicateRemovedPaths = duplicates(removedProducts.map(productPath));
  if (duplicateRemovedCodes.length) errors.push(`${duplicateRemovedCodes.length} duplicate removed-product codes detected.`);
  if (duplicateRemovedPaths.length) errors.push(`${duplicateRemovedPaths.length} duplicate removed-product paths detected.`);
  for (const removed of removedProducts) {
    if (activeCodes.has(removed.code)) errors.push(`Active product ${removed.code} is still listed as removed.`);
    const relative = `${productPath(removed)}index.html`;
    if (!await exists(relative)) { errors.push(`Removed-product page missing: ${relative}`); continue; }
    const page = await fs.readFile(path.join(ROOT, relative), 'utf8');
    if (!/<meta name="robots" content="noindex,follow/i.test(page)) errors.push(`Removed-product page is not noindex,follow: ${removed.code}`);
    if (!page.includes('This design is no longer available')) errors.push(`Removed-product explanation missing: ${removed.code}`);
    if (sitemapUrls.includes(absolute(productPath(removed)))) errors.push(`Removed product is incorrectly present in the sitemap: ${removed.code}`);
  }

  if (!await exists('404.html')) errors.push('Custom 404.html is missing.');
  else {
    const notFound = await fs.readFile(path.join(ROOT, '404.html'), 'utf8');
    if (!/<meta name="robots" content="noindex,follow/i.test(notFound)) errors.push('Custom 404 page is not noindex,follow.');
    if (!/<h1[^>]*>[\s\S]*not found[\s\S]*<\/h1>/i.test(notFound)) errors.push('Custom 404 page lacks a clear not-found heading.');
  }

  const csvRows = parseCsv(await fs.readFile(path.join(ROOT, 'catalogue/meta-product-feed.csv'), 'utf8'));
  const headers = csvRows[0] || [];
  const linkIndex = headers.indexOf('link');
  const idIndex = headers.indexOf('id');
  const titleIndex = headers.indexOf('title');
  if (linkIndex < 0 || idIndex < 0 || titleIndex < 0) errors.push('Meta feed is missing id, title or link columns.');
  const feedRows = csvRows.slice(1);
  const expectedFeedProducts = products.filter(item => Number.isFinite(item.price) && item.price > 0);
  if (feedRows.length !== expectedFeedProducts.length) errors.push(`Meta feed has ${feedRows.length} rows; expected ${expectedFeedProducts.length}.`);
  const invalidFeedLinks = linkIndex < 0 ? [] : feedRows.filter(row => !String(row[linkIndex] || '').startsWith(`${BASE}/products/`));
  if (invalidFeedLinks.length) errors.push(`${invalidFeedLinks.length} Meta feed links do not use canonical product pages.`);
  if (idIndex >= 0) {
    const duplicateFeedIds = duplicates(feedRows.map(row => row[idIndex]));
    if (duplicateFeedIds.length) errors.push(`${duplicateFeedIds.length} duplicate product IDs exist in the Meta feed.`);
  }
  if (titleIndex >= 0) {
    const duplicateFeedTitles = duplicates(feedRows.map(row => cleanText(row[titleIndex]).toLowerCase()));
    if (duplicateFeedTitles.length) errors.push(`${duplicateFeedTitles.length} duplicate Meta feed titles remain after disambiguation.`);
  }

  const htmlFiles = [...await listHtml('products'), ...await listHtml('collections'), ...await listHtml('shop'), '404.html'];
  const brokenInternalLinks = [];
  for (const file of htmlFiles) {
    const page = await fs.readFile(path.join(ROOT, file), 'utf8');
    for (const match of page.matchAll(/href="([^"]+)"/gi)) {
      const route = internalRoute(match[1]);
      if (!route) continue;
      const target = routeFile(route);
      if (!await exists(target)) brokenInternalLinks.push({ source: file, href: match[1], target });
    }
  }
  if (brokenInternalLinks.length) errors.push(`${brokenInternalLinks.length} broken internal links detected in generated pages.`);

  const report = {
    ok: errors.length === 0,
    generatedAt: new Date().toISOString(),
    summary: {
      products: products.length,
      removedProducts: removedProducts.length,
      brands: brands.length,
      collectionPages: expectedCollectionPages,
      sitemapUrls: sitemapUrls.length,
      metaFeedRows: feedRows.length,
      metadataPages: metadata.length,
      internalHtmlFiles: htmlFiles.length,
      errors: errors.length,
      warnings: warnings.length
    },
    errors,
    warnings,
    samples: {
      duplicateCodes: duplicateCodes.slice(0, 25),
      categoryConflicts: categoryConflicts.slice(0, 25).map(item => ({ code: item.code, name: item.name, category: item.category })),
      missingDescriptions: missingDescriptions.slice(0, 25).map(item => item.code),
      duplicateTitles: duplicateTitles.slice(0, 25),
      duplicateDescriptions: duplicateDescriptions.slice(0, 25),
      duplicateH1s: duplicateH1s.slice(0, 25),
      duplicateSchemaNames: duplicateSchemaNames.slice(0, 25),
      brokenInternalLinks: brokenInternalLinks.slice(0, 50),
      removedProducts: removedProducts.slice(0, 25).map(item => ({ code: item.code, name: item.name, path: productPath(item) }))
    },
    hostPolicy
  };
  await fs.writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  if (errors.length) throw new Error(`Catalogue validation failed with ${errors.length} error(s). See catalogue/validation-report.json.`);
  console.log(`Catalogue validation passed with ${warnings.length} warning(s), ${removedProducts.length} removed-product page(s) and no duplicate metadata.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
