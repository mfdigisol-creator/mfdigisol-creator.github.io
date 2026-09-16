import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE = 'https://alhumacollection.com';
const ORG_ID = `${BASE}/#organization`;
const EXPECTED_HEADERS = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand', 'product_type'];
const REPORT_FILE = path.join(ROOT, 'catalogue/search-ecosystem-consistency-report.json');

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
const canonicalUrl = item => `${BASE}/${productPath(item)}`;
const decodeHtml = value => String(value ?? '')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(values => values.some(value => value !== ''));
}

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
      // Invalid JSON-LD is reported as a missing Product node below.
    }
  }
  return null;
}

function organizationSchema(html) {
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      const nodes = Array.isArray(data?.['@graph']) ? data['@graph'] : [data];
      const organization = nodes.find(node => {
        const type = node?.['@type'];
        const types = Array.isArray(type) ? type : [type];
        return node?.['@id'] === ORG_ID && types.includes('Organization');
      });
      if (organization) return organization;
    } catch {
      // Invalid JSON-LD is reported below.
    }
  }
  return null;
}

function extract(html, pattern) {
  return decodeHtml(clean(html.match(pattern)?.[1] || '').replace(/<[^>]+>/g, ''));
}

function duplicateValues(values) {
  return [...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map())]
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value, count }));
}

async function readJson(relative, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, relative), 'utf8'));
  } catch {
    return fallback;
  }
}

async function main() {
  const errors = [];
  const catalogue = await readJson('catalogue/dawood-products.json', { products: [], counts: {} });
  const removedRegistry = await readJson('catalogue/removed-products.json', { products: [] });
  const catalogueValidation = await readJson('catalogue/validation-report.json', { warnings: [] });
  const products = Array.isArray(catalogue.products) ? catalogue.products : [];
  const removedProducts = Array.isArray(removedRegistry.products) ? removedRegistry.products : [];

  if (products.length < 20) errors.push(`Catalogue contains only ${products.length} products; refusing ecosystem validation.`);

  const feedText = await fs.readFile(path.join(ROOT, 'catalogue/meta-product-feed.csv'), 'utf8');
  const csvRows = parseCsv(feedText);
  const headers = csvRows[0] || [];
  if (JSON.stringify(headers) !== JSON.stringify(EXPECTED_HEADERS)) {
    errors.push(`Meta feed headers changed unexpectedly. Expected ${EXPECTED_HEADERS.join(', ')}; received ${headers.join(', ')}.`);
  }

  const feedRows = csvRows.slice(1);
  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  const feedObjects = feedRows.map(row => Object.fromEntries(headers.map((header, position) => [header, row[position] ?? ''])));
  const duplicateFeedIds = duplicateValues(feedObjects.map(row => row.id));
  if (duplicateFeedIds.length) errors.push(`${duplicateFeedIds.length} duplicate IDs exist in the Meta feed.`);
  const feedById = new Map(feedObjects.map(row => [row.id, row]));

  const pricedProducts = products.filter(item => Number.isFinite(item.price) && item.price > 0);
  const enquiryProducts = products.filter(item => item.price == null);
  if (feedRows.length !== pricedProducts.length) errors.push(`Meta feed has ${feedRows.length} rows; expected ${pricedProducts.length} priced products.`);
  if (catalogue.counts?.metaFeedProducts !== pricedProducts.length) errors.push('Catalogue metaFeedProducts count does not match the priced-product population.');

  const sitemapText = await fs.readFile(path.join(ROOT, 'catalogue/products-sitemap.xml'), 'utf8');
  const sitemapUrls = [...sitemapText.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1].replace(/&amp;/g, '&'));
  const sitemapSet = new Set(sitemapUrls);
  const duplicateSitemapUrls = duplicateValues(sitemapUrls);
  if (duplicateSitemapUrls.length) errors.push(`${duplicateSitemapUrls.length} duplicate URLs exist in the product sitemap.`);
  if (sitemapUrls.some(url => /[?&]product=/i.test(url))) errors.push('Product sitemap contains legacy query-string product URLs.');

  let productPagesChecked = 0;
  let pricedPagesChecked = 0;
  let enquiryPagesChecked = 0;
  let unavailablePricedProducts = 0;
  let imageMatches = 0;

  for (const item of products) {
    const relative = `${productPath(item)}index.html`;
    let html;
    try {
      html = await fs.readFile(path.join(ROOT, relative), 'utf8');
    } catch {
      errors.push(`Generated product page is missing for ${item.code}: ${relative}`);
      continue;
    }
    productPagesChecked += 1;

    const canonical = extract(html, /<link rel="canonical" href="([^"]+)"/i);
    const ogImage = extract(html, /<meta property="og:image" content="([^"]+)"/i);
    const h1 = extract(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const schema = productSchema(html);
    const expectedCanonical = canonicalUrl(item);

    if (canonical !== expectedCanonical) errors.push(`Canonical mismatch for ${item.code}: ${canonical || 'missing'}.`);
    if (!sitemapSet.has(expectedCanonical)) errors.push(`Canonical product URL missing from sitemap for ${item.code}.`);
    if (!schema) {
      errors.push(`Product JSON-LD missing for ${item.code}.`);
      continue;
    }
    if (clean(schema.sku) !== clean(item.code)) errors.push(`Product schema SKU mismatch for ${item.code}.`);
    if (clean(schema.name) !== h1) errors.push(`Product schema name and visible H1 disagree for ${item.code}.`);
    if (clean(schema.brand?.name) !== clean(item.brand)) errors.push(`Product schema brand mismatch for ${item.code}.`);
    const schemaImages = Array.isArray(schema.image) ? schema.image : [schema.image].filter(Boolean);
    if (schemaImages[0] !== item.image) errors.push(`Product schema primary image mismatch for ${item.code}.`);
    if (ogImage !== item.image) errors.push(`Open Graph primary image mismatch for ${item.code}.`);
    if (schemaImages[0] === item.image && ogImage === item.image) imageMatches += 1;

    const row = feedById.get(item.code);
    const hasCalculatedPrice = Number.isFinite(item.price) && item.price > 0;
    if (hasCalculatedPrice) {
      pricedPagesChecked += 1;
      if (!row) {
        errors.push(`Priced product ${item.code} is absent from the Meta feed.`);
      } else {
        const expectedAvailability = item.available ? 'in stock' : 'out of stock';
        const expectedPrice = `${Number(item.price).toFixed(2)} PKR`;
        const expectedType = `Women > Unstitched Suits > ${item.category}`;
        const expectedDescription = item.available
          ? `${schema.name}. ${item.pieceType} unstitched suit by ${item.brand}. Available to order with Cash on Delivery in Pakistan; final stock is confirmed before dispatch.`
          : `${schema.name}. ${item.pieceType} unstitched suit by ${item.brand}. Currently unavailable in the synchronized catalogue.`;
        if (clean(row.title) !== clean(schema.name)) errors.push(`Meta feed title mismatch for ${item.code}.`);
        if (clean(row.description) !== clean(expectedDescription)) errors.push(`Meta feed description mismatch for ${item.code}.`);
        if (row.availability !== expectedAvailability) errors.push(`Meta feed availability mismatch for ${item.code}.`);
        if (row.condition !== 'new') errors.push(`Meta feed condition changed from new for ${item.code}.`);
        if (row.price !== expectedPrice) errors.push(`Meta feed price mismatch for ${item.code}: ${row.price}.`);
        if (row.link !== expectedCanonical) errors.push(`Meta feed link mismatch for ${item.code}.`);
        if (row.image_link !== item.image) errors.push(`Meta feed image mismatch for ${item.code}.`);
        if (clean(row.brand) !== clean(item.brand)) errors.push(`Meta feed brand mismatch for ${item.code}.`);
        if (row.product_type !== expectedType) errors.push(`Meta feed product_type mismatch for ${item.code}.`);
      }

      const offer = schema.offers;
      if (!offer || Array.isArray(offer)) {
        errors.push(`Single Offer missing for priced product ${item.code}.`);
      } else {
        const expectedAvailabilityUrl = item.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
        if (offer.url !== expectedCanonical) errors.push(`Offer URL mismatch for ${item.code}.`);
        if (offer.priceCurrency !== 'PKR') errors.push(`Offer currency mismatch for ${item.code}.`);
        if (Number(offer.price) !== Number(item.price)) errors.push(`Offer price mismatch for ${item.code}.`);
        if (offer.availability !== expectedAvailabilityUrl) errors.push(`Offer availability mismatch for ${item.code}.`);
        if (offer.seller?.['@id'] !== ORG_ID) errors.push(`Offer seller entity mismatch for ${item.code}.`);
      }
      if (!item.available) {
        unavailablePricedProducts += 1;
        if (!/Currently unavailable/i.test(html)) errors.push(`Unavailable product page lacks visible unavailable state for ${item.code}.`);
      }
    } else {
      enquiryPagesChecked += 1;
      if (row) errors.push(`Price-on-enquiry product ${item.code} is incorrectly present in the Meta feed.`);
      if (schema.offers != null) errors.push(`Price-on-enquiry product ${item.code} incorrectly contains Offer schema.`);
      if (!/Price on enquiry/i.test(html)) errors.push(`Price-on-enquiry product page lacks visible enquiry price for ${item.code}.`);
    }
  }

  const pricedCodes = new Set(pricedProducts.map(item => item.code));
  const staleFeedRows = feedObjects.filter(row => !pricedCodes.has(row.id));
  if (staleFeedRows.length) errors.push(`${staleFeedRows.length} stale or unsupported rows exist in the Meta feed.`);

  const enquiryCodes = new Set(enquiryProducts.map(item => item.code));
  const leakedEnquiryRows = feedObjects.filter(row => enquiryCodes.has(row.id));
  if (leakedEnquiryRows.length) errors.push(`${leakedEnquiryRows.length} price-on-enquiry products leaked into the Meta feed.`);

  const removedCodes = new Set(removedProducts.map(item => item.code));
  const removedFeedRows = feedObjects.filter(row => removedCodes.has(row.id));
  if (removedFeedRows.length) errors.push(`${removedFeedRows.length} removed products remain in the Meta feed.`);
  const removedSitemapUrls = removedProducts.map(canonicalUrl).filter(url => sitemapSet.has(url));
  if (removedSitemapUrls.length) errors.push(`${removedSitemapUrls.length} removed products remain in the product sitemap.`);

  if (feedObjects.some(row => !row.link.startsWith(`${BASE}/products/`) || /[?&]product=/i.test(row.link))) {
    errors.push('Meta feed contains a non-canonical or legacy query-string product link.');
  }

  const policyHtml = await fs.readFile(path.join(ROOT, 'policies.html'), 'utf8');
  const policyOrganization = organizationSchema(policyHtml);
  if (!policyOrganization) {
    errors.push('Policies page does not expose the stable Al Huma Organization entity.');
  } else {
    const types = Array.isArray(policyOrganization['@type']) ? policyOrganization['@type'] : [policyOrganization['@type']];
    if (!types.includes('ClothingStore')) errors.push('Policies Organization entity no longer includes ClothingStore.');
    if (policyOrganization.logo !== `${BASE}/assets/alhuma-collection-logo.webp`) errors.push('Policies Organization logo does not use the official asset.');
    if (policyOrganization.currenciesAccepted !== 'PKR') errors.push('Policies Organization currenciesAccepted is not PKR.');
    if (policyOrganization.hasMerchantReturnPolicy?.merchantReturnLink !== `${BASE}/policies.html#exchange-returns`) {
      errors.push('Merchant return-policy link does not resolve to the approved policies section.');
    }
  }

  const result = {
    ok: errors.length === 0,
    generatedAt: new Date().toISOString(),
    summary: {
      products: products.length,
      productPagesChecked,
      pricedProducts: pricedProducts.length,
      enquiryProducts: enquiryProducts.length,
      feedRows: feedRows.length,
      sitemapUrls: sitemapUrls.length,
      pricedPagesChecked,
      enquiryPagesChecked,
      unavailablePricedProducts,
      primaryImageMatches: imageMatches,
      staleFeedRows: staleFeedRows.length,
      removedFeedRows: removedFeedRows.length,
      removedSitemapUrls: removedSitemapUrls.length,
      errors: errors.length,
      upstreamCatalogueWarnings: Array.isArray(catalogueValidation.warnings) ? catalogueValidation.warnings.length : 0
    },
    errors,
    upstreamCatalogueWarnings: Array.isArray(catalogueValidation.warnings) ? catalogueValidation.warnings : [],
    safeguards: {
      canonicalOrigin: BASE,
      sellerEntity: ORG_ID,
      priceOnEnquiryExcludedFromFeed: leakedEnquiryRows.length === 0,
      priceOnEnquiryOfferSuppressed: errors.every(error => !error.startsWith('Price-on-enquiry product') || !error.includes('Offer schema')),
      unsupportedFeedColumnsAdded: JSON.stringify(headers) !== JSON.stringify(EXPECTED_HEADERS),
      legacyQueryProductLinks: feedObjects.filter(row => /[?&]product=/i.test(row.link)).length,
      externalAccountChangesRequired: false
    }
  };

  await fs.writeFile(REPORT_FILE, `${JSON.stringify(result, null, 2)}\n`);
  if (errors.length) {
    throw new Error(`Search-ecosystem consistency validation failed with ${errors.length} error(s). See catalogue/search-ecosystem-consistency-report.json.`);
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
