import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE = 'https://dawooddesigners.com';
const OUTPUT = path.resolve('catalogue/dawood-products.json');
const STATUS_OUTPUT = path.resolve('catalogue/sync-status.json');
const PRODUCT_SITEMAP_OUTPUT = path.resolve('catalogue/products-sitemap.xml');
const FORMAL_HEADING = 'UNSTITCHED FORMAL BRANDS';
const LUXURY_HEADING = 'UNSTITCHED LUXURY BRANDS';
const NEXT_HEADING = 'READY TO WEAR BRANDS';
const EMBROIDERY_PATTERN = /\bemb(?:\.|roidery|roidered)?\b|chikan|chicken|schiffli|shiffli|laser[ -]?cut|cutwork|boring|patch|appliqu[eé]|sequence|sequins?/i;
const NON_EMBROIDERY_PATTERN = /\bdigital(?:ly)?\s+print|\bprinted\b|\bprint\b|\bplain\b|\bsolid\b|\bblock\s*print|\bwash\s*&?\s*wear\b/i;
const PIECE_PATTERN = /\b([123])\s*(?:pc|pcs|piece)\b/i;
const MAX_SOURCE_PRICE_CHANGE = 0.5;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchText(url, attempt = 1) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/json',
      'user-agent': 'AlHumaCollectionCatalogueSync/1.0 (+https://alhumacollection.com)'
    }
  });
  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    await sleep(1000 * 2 ** attempt);
    return fetchText(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

const decodeEntities = value => value
  .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&ndash;|&#8211;/g, '–').replace(/&mdash;|&#8212;/g, '—')
  .replace(/&nbsp;/g, ' ');

const cleanText = value => decodeEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());

function approvedCollections(html) {
  const upper = html.toUpperCase();
  const formalStart = upper.indexOf(FORMAL_HEADING);
  const luxuryStart = upper.indexOf(LUXURY_HEADING, formalStart + FORMAL_HEADING.length);
  const nextStart = upper.indexOf(NEXT_HEADING, luxuryStart + LUXURY_HEADING.length);
  if (formalStart < 0 || luxuryStart < 0 || nextStart < 0) {
    throw new Error('Approved navigation sections could not be identified. No catalogue was changed.');
  }

  const parse = (fragment, group) => {
    const entries = [];
    const anchorPattern = /<a\b[^>]*href=["'](?:https?:\/\/dawooddesigners\.com)?\/collections\/([^"'?/#]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const match of fragment.matchAll(anchorPattern)) {
      const handle = match[1].trim();
      const label = cleanText(match[2]);
      if (handle && label && !['all', 'frontpage'].includes(handle)) entries.push({ handle, label, group });
    }
    return entries;
  };

  const formal = parse(html.slice(formalStart, luxuryStart), 'Formal');
  const luxury = parse(html.slice(luxuryStart, nextStart), 'Luxury');
  const unique = new Map();
  for (const item of [...formal, ...luxury]) unique.set(`${item.group}:${item.handle}`, item);
  if (unique.size < 5) throw new Error(`Only ${unique.size} approved collections were found; refusing an incomplete update.`);
  return [...unique.values()];
}

async function collectionProducts(collection) {
  const products = [];
  for (let page = 1; page <= 20; page += 1) {
    const url = `${SOURCE}/collections/${collection.handle}/products.json?limit=250&page=${page}`;
    const payload = JSON.parse(await fetchText(url));
    const batch = Array.isArray(payload.products) ? payload.products : [];
    products.push(...batch);
    if (batch.length < 250) break;
    await sleep(150);
  }
  return products.map(product => ({ product, collection }));
}

const money = value => Number.parseFloat(String(value || '0').replace(/,/g, ''));
const safeImage = image => image?.src ? image.src.replace(/^\/\//, 'https://') : '';

function normalizeProduct({ product, collection }) {
  const imageById = new Map((product.images || []).map(image => [image.id, safeImage(image)]));
  const searchText = [product.title, product.body_html, product.product_type, ...(product.tags || [])].join(' ');
  const normalizedSearchText = cleanText(searchText);
  const pricingClass = EMBROIDERY_PATTERN.test(normalizedSearchText)
    ? 'embroidered'
    : NON_EMBROIDERY_PATTERN.test(normalizedSearchText) ? 'non-embroidered' : 'unknown';
  const embroidered = pricingClass === 'embroidered' ? true : pricingClass === 'non-embroidered' ? false : null;
  const markup = pricingClass === 'embroidered' ? 2500 : pricingClass === 'non-embroidered' ? 1000 : null;
  const pieceMatch = normalizedSearchText.match(PIECE_PATTERN);
  const pieceType = pieceMatch ? `${pieceMatch[1]} Piece` : 'Unspecified';
  const variants = product.variants?.length ? product.variants : [{ id: product.id, title: 'Default Title', price: '0', available: false }];

  return variants.map((variant, index) => {
    const hasNamedVariant = variants.length > 1 || !/^default title$/i.test(variant.title || '');
    const sourcePrice = money(variant.price);
    const variantImage = safeImage(variant.featured_image) || imageById.get(variant.image_id);
    const image = variantImage || safeImage(product.images?.[index]) || safeImage(product.images?.[0]);
    const code = String(variant.sku || `DD-${product.id}-${variant.id}`).trim();
    const name = hasNamedVariant ? `${product.title} — ${variant.title}` : product.title;
    return {
      id: `${product.id}-${variant.id}`,
      code,
      name: cleanText(name),
      productName: cleanText(product.title),
      variant: hasNamedVariant ? cleanText(variant.title) : '',
      brand: cleanText(product.vendor || collection.label),
      category: collection.group,
      sourceCollection: collection.label,
      sourceCollectionHandle: collection.handle,
      embroidered,
      sourcePrice,
      markup,
      price: markup === null ? null : sourcePrice + markup,
      pricingClass,
      pricingStatus: markup === null ? 'enquire' : 'calculated',
      pricingReason: markup === null ? 'classification-uncertain' : null,
      pieceType,
      currency: 'PKR',
      available: Boolean(variant.available),
      image,
      images: (product.images || []).map(safeImage).filter(Boolean).slice(0, 6),
      sourceUrl: `${SOURCE}/products/${product.handle}`,
      updatedAt: product.updated_at || null
    };
  });
}

async function main() {
  const startedAt = new Date().toISOString();
  const homepage = await fetchText(`${SOURCE}/collections`);
  const collections = approvedCollections(homepage);
  const records = [];

  for (const collection of collections) {
    const items = await collectionProducts(collection);
    records.push(...items.flatMap(normalizeProduct));
    await sleep(175);
  }

  const deduplicated = new Map();
  for (const item of records) {
    const existing = deduplicated.get(item.id);
    if (!existing || (item.category === 'Luxury' && existing.category !== 'Luxury')) deduplicated.set(item.id, item);
  }
  const previous = await fs.readFile(OUTPUT, 'utf8').then(JSON.parse).catch(() => ({ products: [] }));
  const previousPrices = new Map((previous.products || []).map(item => [item.code, Number(item.sourcePrice)]));
  const products = [...deduplicated.values()]
    .filter(item => item.image && item.sourcePrice > 0)
    .map(item => {
      const oldPrice = previousPrices.get(item.code);
      const changedTooFar = oldPrice > 0 && Math.abs(item.sourcePrice - oldPrice) / oldPrice > MAX_SOURCE_PRICE_CHANGE;
      if (!changedTooFar) return item;
      return { ...item, price: null, markup: null, pricingStatus: 'enquire', pricingReason: 'source-price-change-review' };
    })
    .sort((a, b) => Number(b.available) - Number(a.available) || a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));

  if (products.length < 20) throw new Error(`Only ${products.length} products were produced; refusing an incomplete update.`);

  const catalogue = {
    schemaVersion: 1,
    source: SOURCE,
    authorization: 'Dawood Designers approval dated 2026-07-21',
    synchronizedAt: new Date().toISOString(),
    pricing: { nonEmbroideredMarkup: 1000, embroideredMarkup: 2500, currency: 'PKR' },
    counts: {
      products: products.length,
      available: products.filter(item => item.available).length,
      formal: products.filter(item => item.category === 'Formal').length,
      luxury: products.filter(item => item.category === 'Luxury').length,
      priceOnEnquiry: products.filter(item => item.price === null).length
    },
    products
  };

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, `${JSON.stringify(catalogue, null, 2)}\n`);
  await fs.writeFile(STATUS_OUTPUT, `${JSON.stringify({ ok: true, startedAt, completedAt: catalogue.synchronizedAt, ...catalogue.counts }, null, 2)}\n`);
  const productUrls = products.map(item => `  <url><loc>https://alhumacollection.com/?product=${encodeURIComponent(item.code).replace(/&/g, '&amp;')}</loc><lastmod>${catalogue.synchronizedAt.slice(0,10)}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`).join('\n');
  await fs.writeFile(PRODUCT_SITEMAP_OUTPUT, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${productUrls}\n</urlset>\n`);
  console.log(`Synchronized ${products.length} products from ${collections.length} approved catalogue collections.`);
}

main().catch(async error => {
  await fs.mkdir(path.dirname(STATUS_OUTPUT), { recursive: true });
  await fs.writeFile(STATUS_OUTPUT, `${JSON.stringify({ ok: false, failedAt: new Date().toISOString(), error: error.message }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
