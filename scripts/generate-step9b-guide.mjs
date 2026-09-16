import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE = 'https://alhumacollection.com';
const SITE_NAME = 'Al Huma Collection';
const PHONE = '+923216115731';
const ORGANIZATION_ID = `${BASE}/#organization`;
const WEBSITE_ID = `${BASE}/#website`;
const GUIDE_PATH = 'guides/how-to-read-unstitched-suit-listings/';
const GUIDE_URL = `${BASE}/${GUIDE_PATH}`;
const GUIDE_TITLE = '2-Piece vs 3-Piece & Printed vs Embroidered Unstitched Suits | Al Huma Guide';
const GUIDE_H1 = 'How to Read an Unstitched Suit Listing: Piece Count, Style, Price & Availability';
const GUIDE_DESCRIPTION = 'Understand how Al Huma Collection presents piece count, embroidered or printed classification, price, availability and product details in its synchronized unstitched-suit catalogue.';
const GENERAL_LANDING = 'shop/unstitched-suits-pakistan/index.html';
const SITEMAP_PAGES = 'sitemap-pages.xml';
const CATALOGUE_FILE = 'catalogue/dawood-products.json';

const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const countOccurrences = (text, needle) => text.split(needle).length - 1;

async function read(relative) {
  return fs.readFile(path.join(ROOT, relative), 'utf8');
}

async function write(relative, content) {
  const file = path.join(ROOT, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

async function exists(relative) {
  try { await fs.access(path.join(ROOT, relative)); return true; } catch { return false; }
}

function countBy(items, getter) {
  const counts = new Map();
  for (const item of items) {
    const value = clean(getter(item)) || 'Unspecified';
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function jsonLd(value) {
  return `<script type="application/ld+json">${JSON.stringify(value).replace(/</g, '\\u003c')}</script>`;
}

function guideHtml(products) {
  const pieceCounts = countBy(products, item => item.pieceType);
  const pieceSummary = pieceCounts.map(([label, count]) => `${count} ${label}`).join(', ');
  const embroidered = products.filter(item => item.pricingClass === 'embroidered').length;
  const nonEmbroidered = products.filter(item => item.pricingClass === 'non-embroidered').length;
  const enquiryStyle = products.length - embroidered - nonEmbroidered;
  const available = products.filter(item => item.available).length;
  const priced = products.filter(item => item.price != null && Number.isFinite(Number(item.price))).length;
  const priceOnEnquiry = products.length - priced;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Unstitched suit listing guide', item: GUIDE_URL }
    ]
  };
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${GUIDE_URL}#webpage`,
    url: GUIDE_URL,
    name: GUIDE_H1,
    description: GUIDE_DESCRIPTION,
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': ORGANIZATION_ID }
  };

  return `<!doctype html>
<html lang="en-PK"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${html(GUIDE_TITLE)}</title><meta name="description" content="${html(GUIDE_DESCRIPTION)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${GUIDE_URL}">
<meta property="og:site_name" content="${SITE_NAME}"><meta property="og:type" content="website"><meta property="og:title" content="${html(GUIDE_TITLE)}"><meta property="og:description" content="${html(GUIDE_DESCRIPTION)}"><meta property="og:url" content="${GUIDE_URL}">
<meta name="twitter:card" content="summary"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/seo-pages.css?v=seo-batch2-20260731">
<style>.guide{max-width:900px;margin:0 auto;padding:2rem 1rem 4rem}.guide section{margin:2rem 0;padding-top:1.5rem;border-top:1px solid #d8cdbc}.guide h2{line-height:1.2}.guide li{margin:.55rem 0;line-height:1.7}.guide .snapshot{padding:1.25rem;border:1px solid #d8cdbc;background:#fffaf0}.guide .links{display:flex;flex-wrap:wrap;gap:.75rem 1.1rem}</style>${jsonLd(breadcrumbSchema)}${jsonLd(webPageSchema)}
</head><body><a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><a class="brand" href="/" aria-label="Al Huma Collection home"><b>AH</b><span>AL HUMA COLLECTION</span></a><nav aria-label="Primary"><a href="/shop/unstitched-suits-pakistan/">Unstitched Suits</a><a href="/shop/formal-unstitched-suits/">Formal</a><a href="/shop/luxury-lawn-suits/">Luxury Lawn</a><a href="/#new-arrivals">New Arrivals</a></nav></header>
<main id="main" class="guide"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="${BASE}/">Home</a><i>›</i><span aria-current="page">Unstitched suit listing guide</span></nav>
<article><p>Catalogue guide</p><h1>${html(GUIDE_H1)}</h1><p>Al Huma Collection uses synchronized catalogue data to show what is currently known about each design. This guide explains how to read those labels without assuming details that are not present in the retained product data.</p>
<section aria-labelledby="piece-count-heading"><h2 id="piece-count-heading">What 1 Piece, 2 Piece and 3 Piece mean here</h2><p>The piece-count label records how many pieces the synchronized catalogue identifies for a design. It does not, by itself, identify which garment components make up that count.</p><ul><li><strong>1 Piece, 2 Piece or 3 Piece:</strong> the catalogue identifies that total number of pieces.</li><li><strong>Unspecified:</strong> the retained catalogue data does not provide a usable piece-count label.</li><li><strong>Component details:</strong> when retained supplier description text identifies individual components, the product page may show them. When it does not, confirm the contents before ordering rather than assuming a standard combination.</li></ul></section>
<section aria-labelledby="style-heading"><h2 id="style-heading">What the style classification means</h2><p>The catalogue uses the existing pricing classification to present one of three customer-facing style labels:</p><ul><li><strong>Embroidered:</strong> the synchronized record is classified as embroidered for the current catalogue and pricing workflow.</li><li><strong>Printed / non-embroidered:</strong> the synchronized record is classified as non-embroidered for that workflow.</li><li><strong>Details on enquiry:</strong> the retained data does not support a confident embroidered or non-embroidered classification.</li></ul><p>These labels are descriptive catalogue classifications. They do not mean that one style is higher quality, more comfortable, more durable, more popular or better for a particular occasion.</p></section>
<section aria-labelledby="price-heading"><h2 id="price-heading">How to read the price</h2><p>A calculated retail price is displayed when the automated catalogue can confidently classify the design under the approved pricing rules. When classification is uncertain or a supplier-price change requires review, the site shows <strong>Price on enquiry</strong> instead of estimating a price. Final price is confirmed before dispatch.</p></section>
<section aria-labelledby="availability-heading"><h2 id="availability-heading">How to read availability</h2><p><strong>Available to order</strong> reflects the latest synchronized availability in the catalogue. Updates run approximately every 12 hours, but supplier stock can change between updates. Final availability is therefore confirmed before dispatch.</p><p><strong>Currently unavailable</strong> means the latest synchronized catalogue does not mark that design available to order.</p></section>
<section aria-labelledby="verify-heading"><h2 id="verify-heading">What to verify before ordering</h2><ol><li>Check the product code so you are referring to the exact design.</li><li>Read the piece-count and style labels shown on the product page.</li><li>Use the retained product description when component details are present; otherwise confirm the contents.</li><li>Check whether the page shows a calculated price or Price on enquiry.</li><li>Check the current availability label and remember that final stock, price and delivery charges are confirmed before dispatch.</li></ol></section>
<section class="snapshot" aria-labelledby="snapshot-heading"><h2 id="snapshot-heading">Current synchronized catalogue snapshot</h2><p><strong>Designs:</strong> ${products.length} current designs; ${available} are currently marked available to order.</p><p><strong>Piece count:</strong> ${html(pieceSummary)}.</p><p><strong>Style classification:</strong> ${embroidered} embroidered, ${nonEmbroidered} printed / non-embroidered${enquiryStyle ? `, ${enquiryStyle} details on enquiry` : ''}.</p><p><strong>Pricing display:</strong> ${priced} designs currently have a calculated price${priceOnEnquiry ? `; ${priceOnEnquiry} show Price on enquiry` : ''}.</p><p>These figures are regenerated from the current synchronized catalogue; they are not fixed editorial totals.</p></section>
<section aria-labelledby="browse-heading"><h2 id="browse-heading">Use the guide with the live catalogue</h2><p class="links"><a href="/shop/unstitched-suits-pakistan/">All unstitched suits</a><a href="/shop/formal-unstitched-suits/">Formal unstitched suits</a><a href="/shop/luxury-lawn-suits/">Luxury lawn suits</a><a href="/policies.html">Customer policies</a><a href="/#live-catalogue">Open the main catalogue</a></p></section></article></main>
<footer><p><strong>${SITE_NAME}</strong><br>87 Peer, Muradia Rd, Model Town, Sialkot, Pakistan</p><p><a href="https://wa.me/923216115731">WhatsApp ${PHONE}</a> · <a href="/policies.html">Customer policies</a> · <a href="/">Main catalogue</a></p></footer>
<script src="/analytics-config.js?v=20260726-meta-capi-v1" defer></script><script src="/analytics.js?v=20260726-meta-capi-v1" defer></script></body></html>\n`;
}

async function patchGeneralLanding() {
  const before = '<p>Use the current catalogue filters and product pages to compare piece count, style classification, listed price and availability. When a detailed component breakdown is not present in retained supplier data, confirm the contents before ordering.</p></section>';
  const after = '<p>Use the current catalogue filters and product pages to compare piece count, style classification, listed price and availability. When a detailed component breakdown is not present in retained supplier data, confirm the contents before ordering.</p><p><a href="/guides/how-to-read-unstitched-suit-listings/">Understand piece-count and style labels</a></p></section>';
  let landing = await read(GENERAL_LANDING);
  if (!landing.includes(after)) {
    if (!landing.includes(before)) throw new Error('Could not locate the approved Step 9A comparison paragraph; refusing Step 9B landing-page patch.');
    landing = landing.replace(before, after);
    await write(GENERAL_LANDING, landing);
  }
  if (countOccurrences(landing, 'href="/guides/how-to-read-unstitched-suit-listings/"') !== 1) throw new Error('General landing must contain exactly one contextual link to the Step 9B guide.');
}

async function patchSitemap() {
  let sitemap = await read(SITEMAP_PAGES);
  const entry = `  <url><loc>${GUIDE_URL}</loc></url>`;
  if (!sitemap.includes(entry)) {
    if (!sitemap.includes('</urlset>')) throw new Error('sitemap-pages.xml is missing its closing urlset element.');
    sitemap = sitemap.replace('</urlset>', `${entry}\n</urlset>`);
    await write(SITEMAP_PAGES, sitemap);
  }
  if (countOccurrences(sitemap, GUIDE_URL) !== 1) throw new Error('The Step 9B guide must appear exactly once in sitemap-pages.xml.');
}

async function validateGeneratedGuide() {
  const guide = await read(`${GUIDE_PATH}index.html`);
  const landing = await read(GENERAL_LANDING);
  const sitemap = await read(SITEMAP_PAGES);
  const productSitemap = await read('catalogue/products-sitemap.xml');

  const checks = [
    [guide.includes(`<title>${html(GUIDE_TITLE)}</title>`), 'Guide title mismatch.'],
    [guide.includes(`<h1>${html(GUIDE_H1)}</h1>`), 'Guide H1 mismatch.'],
    [guide.includes(`<link rel="canonical" href="${GUIDE_URL}">`), 'Guide canonical mismatch.'],
    [guide.includes('"@type":"WebPage"'), 'WebPage schema is missing.'],
    [guide.includes('"@type":"BreadcrumbList"'), 'BreadcrumbList schema is missing.'],
    [guide.includes(`"@id":"${WEBSITE_ID}"`), 'WebSite entity relationship is missing.'],
    [guide.includes(`"@id":"${ORGANIZATION_ID}"`), 'Organization entity relationship is missing.'],
    [!guide.includes('"@type":"FAQPage"'), 'FAQPage schema is not authorized.'],
    [!guide.includes('"@type":"HowTo"'), 'HowTo schema is not authorized.'],
    [!guide.includes('"@type":"Article"'), 'Article schema is not authorized.'],
    [countOccurrences(landing, `href="/${GUIDE_PATH}"`) === 1, 'General landing does not contain exactly one guide link.'],
    [countOccurrences(sitemap, GUIDE_URL) === 1, 'Guide sitemap entry is missing or duplicated.'],
    [!productSitemap.includes(GUIDE_URL), 'Guide must not be duplicated in the product sitemap.']
  ];
  for (const [ok, message] of checks) if (!ok) throw new Error(message);

  const requiredRoutes = [
    'index.html',
    'policies.html',
    'shop/unstitched-suits-pakistan/index.html',
    'shop/formal-unstitched-suits/index.html',
    'shop/luxury-lawn-suits/index.html'
  ];
  for (const route of requiredRoutes) if (!await exists(route)) throw new Error(`Required guide destination is missing: ${route}`);

  const guideFiles = [];
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith('.html')) guideFiles.push(full);
    }
  }
  await walk(path.join(ROOT, 'guides'));
  if (guideFiles.length !== 1) throw new Error(`Expected exactly one generated guide HTML file; found ${guideFiles.length}.`);

  const compareFiles = ['index.html', 'policies.html', GENERAL_LANDING, 'shop/formal-unstitched-suits/index.html', 'shop/luxury-lawn-suits/index.html'];
  for (const relative of compareFiles) {
    const page = await read(relative);
    if (page.includes(`<title>${html(GUIDE_TITLE)}</title>`)) throw new Error(`Guide title duplicates ${relative}.`);
    if (page.includes(`<h1>${html(GUIDE_H1)}</h1>`)) throw new Error(`Guide H1 duplicates ${relative}.`);
    if (page.includes(`content="${html(GUIDE_DESCRIPTION)}"`)) throw new Error(`Guide meta description duplicates ${relative}.`);
  }
}

async function main() {
  const catalogue = JSON.parse(await read(CATALOGUE_FILE));
  const products = Array.isArray(catalogue.products) ? catalogue.products : [];
  if (products.length < 20) throw new Error(`Catalogue contains only ${products.length} products; refusing guide generation.`);

  await fs.rm(path.join(ROOT, 'guides'), { recursive: true, force: true });
  await write(`${GUIDE_PATH}index.html`, guideHtml(products));
  await patchGeneralLanding();
  await patchSitemap();
  await validateGeneratedGuide();

  const embroidered = products.filter(item => item.pricingClass === 'embroidered').length;
  const nonEmbroidered = products.filter(item => item.pricingClass === 'non-embroidered').length;
  const priceOnEnquiry = products.filter(item => item.price == null).length;
  console.log(`Step 9B guide generated and validated from ${products.length} current products (${embroidered} embroidered, ${nonEmbroidered} printed/non-embroidered, ${priceOnEnquiry} price on enquiry).`);
}

await main();
