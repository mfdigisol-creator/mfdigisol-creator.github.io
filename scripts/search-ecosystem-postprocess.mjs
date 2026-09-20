import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE = 'https://alhumacollection.com';
const FEED_FILE = path.join(ROOT, 'catalogue/meta-product-feed.csv');
const HEADERS = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand', 'product_type'];

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const slugify = value => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 90) || 'design';
const productPath = item => clean(item.path) || `products/${slugify(item.code)}-${slugify(item.productName || item.name)}/`;
const csv = value => `"${String(value ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`;

function productSchema(html) {
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      if (data?.['@type'] === 'Product') return data;
      if (Array.isArray(data?.['@graph'])) {
        const product = data['@graph'].find(node => node?.['@type'] === 'Product');
        if (product) return product;
      }
    } catch {
      // Invalid Product JSON-LD is handled below as a missing schema node.
    }
  }
  return null;
}

async function main() {
  const catalogue = JSON.parse(await fs.readFile(path.join(ROOT, 'catalogue/products.json'), 'utf8'));
  const products = Array.isArray(catalogue.products) ? catalogue.products : [];
  const priced = products.filter(item => Number.isFinite(item.price) && item.price > 0);
  if (priced.length < 20) throw new Error(`Only ${priced.length} products qualify for the final product feed; refusing an incomplete feed.`);

  const rows = [];
  for (const item of priced) {
    const relative = `${productPath(item)}index.html`;
    const html = await fs.readFile(path.join(ROOT, relative), 'utf8');
    const schema = productSchema(html);
    if (!schema) throw new Error(`Product JSON-LD missing for ${item.code}; refusing feed generation.`);
    const offer = schema.offers;
    if (!offer || Array.isArray(offer)) throw new Error(`Single Offer missing for priced product ${item.code}; refusing feed generation.`);
    const image = Array.isArray(schema.image) ? schema.image[0] : schema.image;
    const title = clean(schema.name);
    const brand = clean(schema.brand?.name);
    const link = clean(offer.url);
    const price = Number(offer.price);
    const currency = clean(offer.priceCurrency);
    const expectedLink = `${BASE}/${productPath(item)}`;

    if (clean(schema.sku) !== clean(item.code)) throw new Error(`Product schema SKU mismatch for ${item.code}.`);
    if (!title || !brand || !image) throw new Error(`Product schema title, brand or image missing for ${item.code}.`);
    if (link !== expectedLink) throw new Error(`Offer URL is not the canonical product URL for ${item.code}.`);
    if (currency !== 'PKR' || price !== Number(item.price)) throw new Error(`Offer price/currency mismatch for ${item.code}.`);

    const description = item.available
      ? `${title}. ${item.pieceType} unstitched suit by ${brand}. Available to order with Cash on Delivery in Pakistan; final stock is confirmed before dispatch.`
      : `${title}. ${item.pieceType} unstitched suit by ${brand}. Currently unavailable in the synchronized catalogue.`;

    rows.push([
      item.code,
      title,
      description,
      item.available ? 'in stock' : 'out of stock',
      'new',
      `${price.toFixed(2)} ${currency}`,
      link,
      image,
      brand,
      `Women > Unstitched Suits > ${item.category}`
    ].map(csv).join(','));
  }

  if (rows.length !== Number(catalogue.counts?.metaFeedProducts)) {
    throw new Error(`Final feed row count ${rows.length} does not match catalogue metaFeedProducts ${catalogue.counts?.metaFeedProducts}.`);
  }

  await fs.writeFile(FEED_FILE, `${HEADERS.map(csv).join(',')}\n${rows.join('\n')}\n`);
  console.log(JSON.stringify({
    ok: true,
    products: products.length,
    feedRows: rows.length,
    priceOnEnquiryExcluded: products.filter(item => item.price == null).length,
    sourceOfTruth: 'final generated Product JSON-LD plus synchronized catalogue',
    canonicalOrigin: BASE
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
