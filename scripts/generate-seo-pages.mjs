import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE = 'https://alhumacollection.com';
const DATA_FILE = path.join(ROOT, 'catalogue/dawood-products.json');
const SITE_NAME = 'Al Huma Collection';
const PHONE = '+923216115731';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const slugify = value => String(value || '')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '').slice(0, 90) || 'design';

const money = value => value == null ? 'Price on enquiry' : `Rs. ${Number(value).toLocaleString('en-PK')}`;
const absolute = relative => `${BASE}/${relative.replace(/^\//, '')}`;
const jsonLd = data => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
const productPath = product => `products/${slugify(product.code)}-${slugify(product.productName || product.name)}/`;
let collectionSlugs = new Map();
const collectionPath = brand => `collections/${collectionSlugs.get(brand) || slugify(brand)}/`;

function imageUrl(url, width = 720) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('cdn.shopify.com')) parsed.searchParams.set('width', String(width));
    return parsed.href;
  } catch { return url; }
}

function pageShell({ title, description, canonical, body, schema = [], robots = 'index,follow,max-image-preview:large' }) {
  return `<!doctype html>
<html lang="en-PK">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/seo-pages.css?v=seo-20260722">
  ${schema.map(jsonLd).join('\n  ')}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header"><a class="brand" href="/" aria-label="Al Huma Collection home"><b>AH</b><span>AL HUMA COLLECTION</span></a><nav aria-label="Primary"><a href="/shop/unstitched-suits-pakistan/">Unstitched Suits</a><a href="/shop/formal-unstitched-suits/">Formal</a><a href="/shop/luxury-lawn-suits/">Luxury Lawn</a><a href="/#new-arrivals">New Arrivals</a></nav></header>
  <main id="main">${body}</main>
  <footer><p><strong>Al Huma Collection</strong><br>87 Peer, Muradia Rd, Model Town, Sialkot, Pakistan</p><p><a href="https://wa.me/923216115731">WhatsApp ${PHONE}</a> · <a href="/policies.html">Customer policies</a> · <a href="/">Main catalogue</a></p></footer>
</body>
</html>\n`;
}

const breadcrumbSchema = items => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url }))
});

const breadcrumbs = items => `<nav class="breadcrumbs" aria-label="Breadcrumb">${items.map((item, index) => index === items.length - 1 ? `<span aria-current="page">${escapeHtml(item.name)}</span>` : `<a href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a>`).join('<i>›</i>')}</nav>`;

function productCard(product) {
  return `<article class="product-card"><a href="/${productPath(product)}"><img src="${escapeHtml(imageUrl(product.image, 520))}" alt="${escapeHtml(`${product.name} unstitched suit by ${product.brand}`)}" width="520" height="650" loading="lazy"><span>${escapeHtml(product.brand)}</span><h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(money(product.price))} · ${product.available ? 'Available to order' : 'Currently unavailable'}</p></a></article>`;
}

async function write(relative, content) {
  const file = path.join(ROOT, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

async function removeGenerated() {
  for (const directory of ['products', 'collections', 'shop']) await fs.rm(path.join(ROOT, directory), { recursive: true, force: true });
}

const landingPages = [
  {
    slug: 'unstitched-suits-pakistan', title: 'Unstitched Suits Pakistan | Shop Branded Designs Online',
    h1: 'Unstitched Suits in Pakistan', description: 'Shop branded unstitched suits online in Pakistan. Explore formal, embroidered, printed and luxury designs with current prices, COD and delivery nationwide.',
    intro: 'Discover a curated selection of branded unstitched suits for women across Pakistan. Compare formal, embroidered, printed and luxury designs, then order with personal confirmation and Cash on Delivery.',
    category: null
  },
  {
    slug: 'formal-unstitched-suits', title: 'Formal Unstitched Suits Online in Pakistan | Al Huma',
    h1: 'Formal Unstitched Suits', description: 'Shop elegant formal unstitched suits online in Pakistan. Browse branded embroidered and 3-piece designs for Eid, weddings, dinners and special occasions.',
    intro: 'Explore formal unstitched suits chosen for weddings, Eid, festive gatherings and refined evening wear. Browse current branded designs, prices and availability before ordering online or through WhatsApp.',
    category: 'Formal'
  },
  {
    slug: 'luxury-lawn-suits', title: 'Luxury Lawn Suits Online Pakistan | Branded Unstitched',
    h1: 'Luxury Lawn Suits Online', description: 'Buy luxury lawn suits online in Pakistan. Browse premium branded unstitched lawn, embroidered 3-piece collections and elegant seasonal designs with COD.',
    intro: 'Shop luxury lawn suits online from a curated range of Pakistani brands. Find premium unstitched lawn, embroidered three-piece designs and graceful seasonal collections with nationwide delivery.',
    category: 'Luxury'
  }
];

async function main() {
  const catalogue = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  const products = catalogue.products || [];
  if (products.length < 20) throw new Error('SEO generation refused: catalogue is unexpectedly small.');
  await removeGenerated();

  const byBrand = new Map();
  for (const product of products) {
    if (!byBrand.has(product.brand)) byBrand.set(product.brand, []);
    byBrand.get(product.brand).push(product);
  }
  const usedCollectionSlugs = new Set();
  for (const brand of [...byBrand.keys()].sort()) {
    const base = slugify(brand);
    let slug = base;
    let suffix = 2;
    while (usedCollectionSlugs.has(slug)) slug = `${base}-${suffix++}`;
    usedCollectionSlugs.add(slug);
    collectionSlugs.set(brand, slug);
  }

  for (const [brand, items] of [...byBrand].sort(([a], [b]) => a.localeCompare(b))) {
    const available = items.filter(item => item.available).length;
    const canonical = absolute(collectionPath(brand));
    const description = `Shop ${brand} unstitched suits online at Al Huma Collection. Browse ${items.length} current formal and luxury designs, prices and availability with delivery in Pakistan.`;
    const crumbs = [{ name: 'Home', url: `${BASE}/` }, { name: 'Collections', url: `${BASE}/#new-arrivals` }, { name: brand, url: canonical }];
    const body = `${breadcrumbs(crumbs)}<section class="hero"><p>Pakistani designer collection</p><h1>${escapeHtml(brand)} Unstitched Suits</h1><p>Browse ${items.length} ${escapeHtml(brand)} designs, including ${available} currently marked available to order. Prices and availability are refreshed from our approved catalogue source approximately every 12 hours.</p><a class="button" href="https://wa.me/923216115731">Ask on WhatsApp</a></section><section class="content"><h2>Shop ${escapeHtml(brand)} designs online</h2><p>Compare current ${escapeHtml(brand)} unstitched formal and luxury suits by design, pieces, price and availability. Final stock and delivery charges are confirmed personally before dispatch.</p></section><section class="product-grid" aria-label="${escapeHtml(brand)} products">${items.map(productCard).join('')}</section>`;
    await write(`${collectionPath(brand)}index.html`, pageShell({ title: `${brand} Unstitched Suits Online Pakistan | Al Huma`, description, canonical, body, schema: [breadcrumbSchema(crumbs), { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${brand} Unstitched Suits`, url: canonical, description, mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items.slice(0, 50).map((product, index) => ({ '@type': 'ListItem', position: index + 1, url: absolute(productPath(product)), name: product.name })) } }] }));
  }

  for (const landing of landingPages) {
    const relevant = landing.category ? products.filter(item => item.category === landing.category) : products;
    const brandCounts = [...relevant.reduce((map, item) => map.set(item.brand, (map.get(item.brand) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]);
    const canonical = absolute(`shop/${landing.slug}/`);
    const crumbs = [{ name: 'Home', url: `${BASE}/` }, { name: landing.h1, url: canonical }];
    const body = `${breadcrumbs(crumbs)}<section class="hero"><p>Curated Pakistani womenswear</p><h1>${landing.h1}</h1><p>${landing.intro}</p><a class="button" href="/#live-catalogue">Browse the live catalogue</a></section><section class="content"><h2>Browse leading collections</h2><p>Our catalogue currently includes ${relevant.length} matching designs. Choose a collection below to see indexable product pages with current details.</p><div class="collection-links">${brandCounts.map(([brand, count]) => `<a href="/${collectionPath(brand)}"><strong>${escapeHtml(brand)}</strong><span>${count} designs</span></a>`).join('')}</div></section><section class="content"><h2>Ordering and delivery in Pakistan</h2><p>Browse online, add available designs to your cart or contact Al Huma Collection on WhatsApp. We confirm stock, final delivery charges and your Cash on Delivery order before dispatch. Our boutique is located in Model Town, Sialkot, and we deliver across Pakistan.</p></section>`;
    await write(`shop/${landing.slug}/index.html`, pageShell({ title: landing.title, description: landing.description, canonical, body, schema: [breadcrumbSchema(crumbs), { '@context': 'https://schema.org', '@type': 'CollectionPage', name: landing.h1, url: canonical, description: landing.description }] }));
  }

  for (const product of products) {
    const canonical = absolute(productPath(product));
    const collectionUrl = absolute(collectionPath(product.brand));
    const description = `${product.name} by ${product.brand}. ${product.pieceType} unstitched ${product.category.toLowerCase()} suit, ${money(product.price)}, ${product.available ? 'available to order' : 'currently unavailable'} in Pakistan.`.slice(0, 158);
    const crumbs = [{ name: 'Home', url: `${BASE}/` }, { name: product.brand, url: collectionUrl }, { name: product.name, url: canonical }];
    const images = [...new Set([product.image, ...(product.images || [])].filter(Boolean))];
    const offer = product.price == null ? undefined : { '@type': 'Offer', url: canonical, priceCurrency: 'PKR', price: product.price, availability: product.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition', seller: { '@type': 'Organization', name: SITE_NAME } };
    const productSchema = { '@context': 'https://schema.org', '@type': 'Product', name: product.name, sku: product.code, image: images, description, category: `Women's Clothing > Unstitched Suits > ${product.category}`, brand: { '@type': 'Brand', name: product.brand }, ...(offer ? { offers: offer } : {}) };
    const body = `${breadcrumbs(crumbs)}<article class="product-detail"><div class="product-images">${images.slice(0, 4).map((image, index) => `<img src="${escapeHtml(imageUrl(image, index ? 800 : 1100))}" alt="${escapeHtml(`${product.name} ${index ? `detail ${index + 1}` : 'unstitched suit'}`)}" width="800" height="1000" ${index ? 'loading="lazy"' : 'fetchpriority="high"'}>`).join('')}</div><div class="product-copy"><p>${escapeHtml(product.brand)} · ${escapeHtml(product.category)}</p><h1>${escapeHtml(product.name)}</h1><dl><div><dt>Product code</dt><dd>${escapeHtml(product.code)}</dd></div><div><dt>Suit type</dt><dd>${escapeHtml(product.pieceType)}</dd></div><div><dt>Style</dt><dd>${product.pricingClass === 'embroidered' ? 'Embroidered' : product.pricingClass === 'non-embroidered' ? 'Printed / non-embroidered' : 'Details on enquiry'}</dd></div><div><dt>Availability</dt><dd>${product.available ? 'Available to order — confirmation required' : 'Currently unavailable'}</dd></div></dl><p class="price">${escapeHtml(money(product.price))}</p><a class="button" href="https://wa.me/923216115731?text=${encodeURIComponent(`Hello Al Huma Collection, I am interested in ${product.name} (${product.code}). ${canonical}`)}">Order or enquire on WhatsApp</a><p class="note">Catalogue status is refreshed approximately every 12 hours. Final availability, price and delivery charges are confirmed before dispatch.</p><p><a href="/${collectionPath(product.brand)}">See all ${escapeHtml(product.brand)} designs</a> · <a href="/#live-catalogue">Open main catalogue</a></p></div></article>`;
    await write(`${productPath(product)}index.html`, pageShell({ title: `${product.name} | ${product.brand} Pakistan`, description, canonical, body, schema: [breadcrumbSchema(crumbs), productSchema] }));
  }

  const lastmod = String(catalogue.synchronizedAt || new Date().toISOString()).slice(0, 10);
  const urls = [
    ...landingPages.map(page => ({ loc: absolute(`shop/${page.slug}/`), priority: '0.9' })),
    ...[...byBrand.keys()].sort().map(brand => ({ loc: absolute(collectionPath(brand)), priority: '0.8' })),
    ...products.map(product => ({ loc: absolute(productPath(product)), priority: '0.7' }))
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(({ loc, priority }) => `  <url><loc>${escapeHtml(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>${priority}</priority></url>`).join('\n')}\n</urlset>\n`;
  await write('catalogue/products-sitemap.xml', sitemap);
  console.log(`Generated ${products.length} product pages, ${byBrand.size} collection pages and ${landingPages.length} category pages.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
