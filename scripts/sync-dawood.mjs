import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sanitizeSupplierDescription } from './product-description.mjs';
import { classifyProduct, normalizeCollection, summarizeScope } from './dawood-taxonomy.mjs';

const SOURCE = 'https://dawooddesigners.com';
const OUTPUT = path.resolve('catalogue/dawood-products.json');
const STATUS_OUTPUT = path.resolve('catalogue/sync-status.json');
const PRODUCT_SITEMAP_OUTPUT = path.resolve('catalogue/products-sitemap.xml');
const META_PRODUCT_FEED_OUTPUT = path.resolve('catalogue/meta-product-feed.csv');
const TAXONOMY_SNAPSHOT_OUTPUT = path.resolve('catalogue/dawood-taxonomy-snapshot.json');
const DRIFT_REPORT_OUTPUT = path.resolve('catalogue/dawood-drift-report.json');

const MAX_SOURCE_PRICE_CHANGE = 0.5;
const MIN_CATALOGUE_PRODUCTS = 50;
const MAX_CATALOGUE_SHRINK_PERCENT = 20;
const MIN_SOURCE_PRODUCTS = 100;
const MIN_SOURCE_COLLECTIONS = 20;
const MAX_AMBIGUOUS_SHARE = 0.10;
const MAX_AMBIGUOUS_ABSOLUTE_WITHOUT_REVIEW = 50;
const MIN_COLLECTION_MEMBERSHIP_SHARE = 0.50;
const MAX_DOWNSTREAM_PRODUCTS = 10_000;
const DRY_RUN = process.argv.includes('--dry-run');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const cleanText = value => String(value ?? '')
  .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&ndash;|&#8211;/g, '–').replace(/&mdash;|&#8212;/g, '—')
  .replace(/&nbsp;/g, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const money = value => Number.parseFloat(String(value || '0').replace(/,/g, ''));
const safeImage = image => image?.src ? image.src.replace(/^\/\//, 'https://') : '';
const csvCell = value => `"${String(value ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`;
const percent = (current, previous) => previous > 0 ? ((current - previous) / previous) * 100 : null;

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

async function fetchText(url, attempt = 1) {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json,text/html',
        'user-agent': 'AlHumaCollectionCatalogueSync/2.0 (+https://alhumacollection.com)'
      },
      signal: AbortSignal.timeout(30_000)
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 6) {
      await sleep(Math.min(30_000, 1250 * 2 ** attempt));
      return fetchText(url, attempt + 1);
    }
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
    return response.text();
  } catch (error) {
    if (attempt < 6 && (error.name === 'AbortError' || error.name === 'TimeoutError' || error instanceof TypeError)) {
      await sleep(Math.min(30_000, 1250 * 2 ** attempt));
      return fetchText(url, attempt + 1);
    }
    throw error;
  }
}

async function fetchJson(url) {
  const text = await fetchText(url);
  try { return JSON.parse(text); }
  catch (error) { throw new Error(`Supplier returned invalid JSON for ${url}: ${error.message}`); }
}

async function fetchPaged(pathname, key, { maxPages = 80, allowEmpty = false } = {}) {
  const all = [];
  const signatures = new Set();
  let completed = false;
  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(pathname, SOURCE);
    url.searchParams.set('limit', '250');
    url.searchParams.set('page', String(page));
    const payload = await fetchJson(url.href);
    const batch = Array.isArray(payload?.[key]) ? payload[key] : null;
    if (!batch) throw new Error(`Supplier schema drift: ${pathname} no longer returns an array named ${key}.`);
    if (!batch.length) { completed = true; break; }
    const signature = batch.slice(0, 5).map(item => item?.id).join(',');
    if (signature && signatures.has(signature)) throw new Error(`Supplier pagination repeated page content for ${pathname}; refusing incomplete discovery.`);
    if (signature) signatures.add(signature);
    all.push(...batch);
    if (batch.length < 250) { completed = true; break; }
    await sleep(80);
  }
  if (!completed) throw new Error(`Supplier pagination exceeded the safety limit for ${pathname}.`);
  if (!allowEmpty && !all.length) throw new Error(`Supplier discovery returned no ${key} from ${pathname}.`);
  return all;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function assertProductSchema(products) {
  const required = product => product
    && product.id != null
    && typeof product.title === 'string'
    && typeof product.handle === 'string'
    && Array.isArray(product.tags)
    && Array.isArray(product.variants)
    && Array.isArray(product.images)
    && typeof product.product_type === 'string';
  const valid = products.filter(required).length;
  const ratio = products.length ? valid / products.length : 0;
  if (ratio < 0.98) {
    throw new Error(`Supplier schema drift: only ${valid}/${products.length} products match the expected Shopify storefront shape.`);
  }
  return { valid, invalid: products.length - valid, validShare: ratio };
}

async function discoverSupplier() {
  const [products, rawCollections] = await Promise.all([
    fetchPaged('/products.json', 'products', { maxPages: 80 }),
    fetchPaged('/collections.json', 'collections', { maxPages: 20 })
  ]);
  const collections = rawCollections.map(normalizeCollection);
  const schemaHealth = assertProductSchema(products);
  if (products.length < MIN_SOURCE_PRODUCTS) throw new Error(`Supplier discovery returned only ${products.length} products; refusing probable source drift.`);
  if (collections.length < MIN_SOURCE_COLLECTIONS) throw new Error(`Supplier discovery returned only ${collections.length} collections; refusing probable source drift.`);
  return { products, collections, schemaHealth };
}

async function buildCollectionMemberships(collections) {
  const membership = new Map();
  const active = collections.filter(collection => collection.handle && collection.productsCount > 0);
  const discovered = await mapLimit(active, 6, async collection => {
    const maxPages = Math.max(2, Math.ceil(collection.productsCount / 250) + 2);
    const products = await fetchPaged(
      `/collections/${encodeURIComponent(collection.handle)}/products.json`,
      'products',
      { maxPages, allowEmpty: false }
    );
    return { collection, products };
  });

  for (const { collection, products } of discovered) {
    for (const product of products) {
      const key = String(product?.id ?? '');
      if (!key) continue;
      if (!membership.has(key)) membership.set(key, []);
      membership.get(key).push(collection);
    }
  }

  for (const list of membership.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title) || a.handle.localeCompare(b.handle));
  }
  return membership;
}

function taxonomyFingerprint(products, collections) {
  const productKeys = [...new Set(products.slice(0, 100).flatMap(product => Object.keys(product || {})))].sort();
  const collectionKeys = [...new Set(collections.slice(0, 100).flatMap(collection => Object.keys(collection || {})))].sort();
  return createHash('sha256')
    .update(JSON.stringify({ productKeys, collectionKeys }))
    .digest('hex');
}

function normalizeProduct(product, classification) {
  const imageById = new Map((product.images || []).map(image => [image.id, safeImage(image)]));
  const pricingClass = classification.pricingClass;
  const embroidered = pricingClass === 'embroidered' ? true : pricingClass === 'non-embroidered' ? false : null;
  const markup = pricingClass === 'embroidered' ? 2500 : pricingClass === 'non-embroidered' ? 1000 : null;
  const sourceDescription = sanitizeSupplierDescription(product.body_html, { productTitle: product.title });
  const variants = product.variants?.length
    ? product.variants
    : [{ id: product.id, title: 'Default Title', price: '0', available: false }];
  const primaryCollection = classification.primaryCollection;
  const sourceCollections = classification.collections.map(collection => ({
    id: collection.id,
    title: collection.title,
    handle: collection.handle
  }));

  return variants.map((variant, index) => {
    const hasNamedVariant = variants.length > 1 || !/^default title$/i.test(variant.title || '');
    const sourcePrice = money(variant.price);
    const variantImage = safeImage(variant.featured_image) || imageById.get(variant.image_id);
    const image = variantImage || safeImage(product.images?.[index]) || safeImage(product.images?.[0]);
    const code = String(variant.sku || `DD-${product.id}-${variant.id}`).trim();
    const name = hasNamedVariant ? `${product.title} — ${variant.title}` : product.title;
    return {
      id: `${product.id}-${variant.id}`,
      sourceProductId: String(product.id),
      code,
      name: cleanText(name),
      productName: cleanText(product.title),
      variant: hasNamedVariant ? cleanText(variant.title) : '',
      brand: cleanText(product.vendor || primaryCollection?.title || 'Other designs'),
      category: classification.category,
      sourceCollection: primaryCollection?.title || 'Supplier catalogue',
      sourceCollectionHandle: primaryCollection?.handle || '',
      sourceCollections,
      seasons: classification.seasons,
      scopeReasons: classification.reasons,
      embroidered,
      sourcePrice,
      markup,
      price: markup === null ? null : sourcePrice + markup,
      pricingClass,
      pricingStatus: markup === null ? 'enquire' : 'calculated',
      pricingReason: markup === null ? 'classification-uncertain' : null,
      pieceType: classification.pieceType,
      sourceDescription: sourceDescription || null,
      currency: 'PKR',
      available: Boolean(variant.available),
      image,
      images: (product.images || []).map(safeImage).filter(Boolean).slice(0, 6),
      sourceUrl: `${SOURCE}/products/${product.handle}`,
      publishedAt: product.published_at || null,
      createdAt: product.created_at || null,
      updatedAt: product.updated_at || null
    };
  });
}

function buildDriftReport({ source, scope, products, previous, snapshot, priorSnapshot }) {
  const previousCount = Array.isArray(previous.products) ? previous.products.length : 0;
  const ambiguousShare = source.products.length ? scope.ambiguous / source.products.length : 1;
  const membershipShare = source.products.length
    ? [...source.products].filter(product => source.memberships.has(String(product.id))).length / source.products.length
    : 0;
  const minimumAfterShrink = previousCount
    ? Math.floor(previousCount * (1 - MAX_CATALOGUE_SHRINK_PERCENT / 100))
    : MIN_CATALOGUE_PRODUCTS;

  const checks = [
    { id: 'source-product-floor', ok: source.products.length >= MIN_SOURCE_PRODUCTS, actual: source.products.length, required: MIN_SOURCE_PRODUCTS },
    { id: 'source-collection-floor', ok: source.collections.length >= MIN_SOURCE_COLLECTIONS, actual: source.collections.length, required: MIN_SOURCE_COLLECTIONS },
    { id: 'collection-membership-share', ok: membershipShare >= MIN_COLLECTION_MEMBERSHIP_SHARE, actual: membershipShare, required: MIN_COLLECTION_MEMBERSHIP_SHARE },
    { id: 'ambiguous-scope-share', ok: scope.ambiguous <= MAX_AMBIGUOUS_ABSOLUTE_WITHOUT_REVIEW || ambiguousShare <= MAX_AMBIGUOUS_SHARE, actual: ambiguousShare, count: scope.ambiguous, required: MAX_AMBIGUOUS_SHARE },
    { id: 'catalogue-emergency-floor', ok: products.length >= MIN_CATALOGUE_PRODUCTS, actual: products.length, required: MIN_CATALOGUE_PRODUCTS },
    { id: 'catalogue-shrink-limit', ok: !previousCount || products.length >= minimumAfterShrink, actual: products.length, required: minimumAfterShrink, previous: previousCount },
    { id: 'downstream-size-limit', ok: products.length <= MAX_DOWNSTREAM_PRODUCTS, actual: products.length, requiredMaximum: MAX_DOWNSTREAM_PRODUCTS }
  ];

  return {
    schemaVersion: 1,
    ok: checks.every(check => check.ok),
    generatedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    checks,
    summary: {
      sourceProducts: source.products.length,
      sourceCollections: source.collections.length,
      includedSourceProducts: scope.included,
      excludedSourceProducts: scope.excluded,
      ambiguousSourceProducts: scope.ambiguous,
      candidateProducts: products.length,
      previousCatalogueProducts: previousCount,
      candidateVsPreviousPercent: percent(products.length, previousCount),
      collectionMembershipShare: membershipShare,
      taxonomyFingerprint: snapshot.taxonomyFingerprint,
      previousTaxonomyFingerprint: priorSnapshot.taxonomyFingerprint || null
    },
    exclusionReasons: scope.exclusionReasons,
    ambiguousSamples: source.classified
      .filter(item => item.classification.status === 'ambiguous')
      .slice(0, 30)
      .map(item => ({
        id: String(item.product.id),
        title: cleanText(item.product.title),
        vendor: cleanText(item.product.vendor),
        reasons: item.classification.reasons,
        collections: item.classification.collections.map(collection => collection.title).slice(0, 8)
      })),
    excludedSamples: source.classified
      .filter(item => item.classification.status === 'excluded')
      .slice(0, 30)
      .map(item => ({
        id: String(item.product.id),
        title: cleanText(item.product.title),
        vendor: cleanText(item.product.vendor),
        reasons: item.classification.reasons
      }))
  };
}

async function writeMetaProductFeed(products) {
  const headers = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand', 'product_type'];
  const rows = products
    .filter(item => Number.isFinite(item.price) && item.price > 0)
    .map(item => [
      item.code,
      item.name,
      `${item.name}. ${item.pieceType} unstitched suit by ${item.brand}. Cash on Delivery in Pakistan. Availability is confirmed before dispatch.`,
      item.available ? 'in stock' : 'out of stock',
      'new',
      `${item.price.toFixed(2)} PKR`,
      `https://alhumacollection.com/?product=${encodeURIComponent(item.code)}`,
      item.image,
      item.brand,
      `Women > Unstitched Suits > ${item.category}`
    ].map(csvCell).join(','));
  if (rows.length < 20) throw new Error(`Only ${rows.length} products qualified for the Meta feed; refusing an incomplete feed.`);
  await fs.writeFile(META_PRODUCT_FEED_OUTPUT, `${headers.map(csvCell).join(',')}\n${rows.join('\n')}\n`);
  return rows.length;
}

async function main() {
  const startedAt = new Date().toISOString();
  const discovered = await discoverSupplier();
  const memberships = await buildCollectionMemberships(discovered.collections);
  const classified = discovered.products.map(product => ({
    product,
    classification: classifyProduct(product, memberships.get(String(product.id)) || [])
  }));
  const scope = summarizeScope(classified);

  const previous = await readJson(OUTPUT, { products: [] });
  const priorSnapshot = await readJson(TAXONOMY_SNAPSHOT_OUTPUT, {});
  const previousPrices = new Map((previous.products || []).map(item => [item.code, Number(item.sourcePrice)]));
  const records = classified
    .filter(item => item.classification.status === 'included')
    .flatMap(item => normalizeProduct(item.product, item.classification));

  const deduplicated = new Map();
  for (const item of records) {
    if (!deduplicated.has(item.id)) deduplicated.set(item.id, item);
  }

  const products = [...deduplicated.values()]
    .filter(item => item.image && item.sourcePrice > 0)
    .map(item => {
      const oldPrice = previousPrices.get(item.code);
      const changedTooFar = oldPrice > 0 && Math.abs(item.sourcePrice - oldPrice) / oldPrice > MAX_SOURCE_PRICE_CHANGE;
      if (!changedTooFar) return item;
      return { ...item, price: null, markup: null, pricingStatus: 'enquire', pricingReason: 'source-price-change-review' };
    })
    .sort((a, b) => Number(b.available) - Number(a.available) || a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));

  const collectionMembershipProducts = discovered.products.filter(product => memberships.has(String(product.id))).length;
  const snapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    sourceProducts: discovered.products.length,
    sourceCollections: discovered.collections.length,
    collectionMembershipProducts,
    collectionMembershipShare: discovered.products.length ? collectionMembershipProducts / discovered.products.length : 0,
    includedSourceProducts: scope.included,
    excludedSourceProducts: scope.excluded,
    ambiguousSourceProducts: scope.ambiguous,
    candidateProducts: products.length,
    taxonomyFingerprint: taxonomyFingerprint(discovered.products, discovered.collections),
    schemaHealth: discovered.schemaHealth,
    seasons: [...new Set(classified.flatMap(item => item.classification.seasons))].sort(),
    brands: [...new Set(products.map(item => item.brand).filter(Boolean))].sort(),
    collections: discovered.collections.map(collection => ({
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
      productsCount: collection.productsCount,
      updatedAt: collection.updatedAt
    }))
  };

  const source = { ...discovered, memberships, classified };
  const drift = buildDriftReport({ source, scope, products, previous, snapshot, priorSnapshot });

  const preflight = {
    mode: DRY_RUN ? 'dry-run' : 'synchronize',
    startedAt,
    completedAt: new Date().toISOString(),
    sourceProducts: discovered.products.length,
    sourceCollections: discovered.collections.length,
    included: scope.included,
    excluded: scope.excluded,
    ambiguous: scope.ambiguous,
    candidateProducts: products.length,
    seasons: snapshot.seasons,
    brands: snapshot.brands.length,
    driftOk: drift.ok,
    checks: drift.checks,
    ambiguousSamples: drift.ambiguousSamples.slice(0, 10),
    excludedSamples: drift.excludedSamples.slice(0, 10)
  };

  if (DRY_RUN) {
    console.log(JSON.stringify(preflight, null, 2));
    if (!drift.ok) throw new Error('Dynamic supplier preflight detected unsafe taxonomy/catalogue drift.');
    return;
  }

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(DRIFT_REPORT_OUTPUT, `${JSON.stringify(drift, null, 2)}\n`);
  if (!drift.ok) throw new Error('Dynamic supplier preflight detected unsafe taxonomy/catalogue drift.');

  const catalogue = {
    schemaVersion: 3,
    source: SOURCE,
    authorization: 'Dawood Designers approval dated 2026-07-21',
    synchronizedAt: new Date().toISOString(),
    discovery: {
      mode: 'dynamic-shopify-storefront',
      sourceProducts: discovered.products.length,
      sourceCollections: discovered.collections.length,
      includedSourceProducts: scope.included,
      excludedSourceProducts: scope.excluded,
      ambiguousSourceProducts: scope.ambiguous,
      taxonomyFingerprint: snapshot.taxonomyFingerprint
    },
    pricing: { nonEmbroideredMarkup: 1000, embroideredMarkup: 2500, currency: 'PKR' },
    counts: {
      products: products.length,
      available: products.filter(item => item.available).length,
      formal: products.filter(item => item.category === 'Formal').length,
      luxury: products.filter(item => item.category === 'Luxury').length,
      priceOnEnquiry: products.filter(item => item.price === null).length,
      metaFeedProducts: products.filter(item => Number.isFinite(item.price) && item.price > 0).length
    },
    products
  };

  await fs.writeFile(TAXONOMY_SNAPSHOT_OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  await fs.writeFile(OUTPUT, `${JSON.stringify(catalogue, null, 2)}\n`);
  await fs.writeFile(STATUS_OUTPUT, `${JSON.stringify({
    ok: true,
    startedAt,
    completedAt: catalogue.synchronizedAt,
    discovery: catalogue.discovery,
    ...catalogue.counts
  }, null, 2)}\n`);

  const productUrls = products
    .map(item => `  <url><loc>https://alhumacollection.com/?product=${encodeURIComponent(item.code).replace(/&/g, '&amp;')}</loc><lastmod>${catalogue.synchronizedAt.slice(0, 10)}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`)
    .join('\n');
  await fs.writeFile(PRODUCT_SITEMAP_OUTPUT, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${productUrls}\n</urlset>\n`);
  await writeMetaProductFeed(products);
  console.log(JSON.stringify(preflight, null, 2));
}

main().catch(async error => {
  if (DRY_RUN) {
    console.error(error);
    process.exitCode = 1;
    return;
  }

  await fs.mkdir(path.dirname(STATUS_OUTPUT), { recursive: true });
  let cachedMetaFeedProducts = 0;
  try {
    const cachedCatalogue = JSON.parse(await fs.readFile(OUTPUT, 'utf8'));
    cachedMetaFeedProducts = await writeMetaProductFeed(cachedCatalogue.products || []);
    console.warn(`Upstream sync failed; preserved the last valid catalogue and generated a ${cachedMetaFeedProducts}-item Meta feed from it.`);
  } catch (fallbackError) {
    console.error('Unable to generate Meta feed from the cached catalogue:', fallbackError);
  }
  await fs.writeFile(STATUS_OUTPUT, `${JSON.stringify({
    ok: false,
    failedAt: new Date().toISOString(),
    error: error.message,
    cataloguePreserved: cachedMetaFeedProducts > 0,
    cachedMetaFeedProducts
  }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
