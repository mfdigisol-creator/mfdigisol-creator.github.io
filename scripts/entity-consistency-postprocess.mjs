import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE = 'https://alhumacollection.com';
const SITE_NAME = 'Al Huma Collection';
const ORGANIZATION_ID = `${BASE}/#organization`;
const WEBSITE_ID = `${BASE}/#website`;
const LOGO_URL = `${BASE}/assets/alhuma-collection-logo.webp`;
const PHONE = '+923216115731';
const PHONE_DISPLAY = '+92 321 6115731';
const EMAIL = 'alhumacollection@gmail.com';
const FACEBOOK = 'https://www.facebook.com/Alhuma.Collection';
const INSTAGRAM = 'https://www.instagram.com/alhuma.collection/';
const ADDRESS_TEXT = 'Al Huma Collection, 87 Peer, Muradia Rd, Model Town, Sialkot, Pakistan';
const CONTACT_PARAGRAPH = '<p>Al Huma Collection is a Sialkot-based retailer and curated showroom for branded ladies’ unstitched suits. Explore the current formal, embroidered and luxury collections online, then use our official contact channels for price, availability and ordering assistance.</p>';
const LEGACY_CONTACT_PARAGRAPH = '<p>Al Huma Collection is a curated womenswear showroom in Sialkot, bringing together distinctive three-piece ensembles for women who appreciate graceful design, quality fabric, and personal service. Explore our latest collections online, then speak directly with our team for prices, availability, and ordering assistance.</p>';
const LEGACY_GENERATED_BRAND = '<a class="brand" href="/" aria-label="Al Huma Collection home"><b>AH</b><span>AL HUMA COLLECTION</span></a>';
const GENERATED_BRAND = '<a class="brand" href="/" aria-label="Al Huma Collection home"><img class="official-brand-logo" src="/assets/alhuma-collection-logo.webp" alt="" aria-hidden="true" width="42" height="42" decoding="async" style="width:42px;height:42px;object-fit:contain;flex:0 0 auto;"><span>AL HUMA COLLECTION</span></a>';

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const slugify = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'design';
const productPath = item => clean(item.path) || `products/${slugify(item.code)}-${slugify(item.productName || item.name)}/`;
const productPageFile = item => `${productPath(item).replace(/^\/+|\/+$/g, '')}/index.html`;
const isNoindexRedirect = source => source.includes('content="noindex,follow"') && source.includes('http-equiv="refresh"');

const policySchema = {
  '@context': 'https://schema.org',
  '@type': ['Organization', 'ClothingStore'],
  '@id': ORGANIZATION_ID,
  name: SITE_NAME,
  url: `${BASE}/`,
  logo: LOGO_URL,
  email: EMAIL,
  telephone: PHONE,
  address: {
    '@type': 'PostalAddress',
    streetAddress: '87 Peer, Muradia Rd, Model Town',
    addressLocality: 'Sialkot',
    addressRegion: 'Punjab',
    addressCountry: 'PK'
  },
  areaServed: { '@type': 'Country', name: 'Pakistan' },
  currenciesAccepted: 'PKR',
  sameAs: [FACEBOOK, INSTAGRAM],
  hasMerchantReturnPolicy: {
    '@type': 'MerchantReturnPolicy',
    merchantReturnLink: `${BASE}/policies.html#exchange-returns`
  }
};

const policySchemaScript = `<script type="application/ld+json">\n${JSON.stringify(policySchema, null, 2)}\n  </script>`;

async function read(relative) {
  return fs.readFile(path.join(ROOT, relative), 'utf8');
}

async function writeIfChanged(relative, before, after, changed) {
  if (before === after) return;
  await fs.writeFile(path.join(ROOT, relative), after);
  changed.push(relative);
}

async function exists(relative) {
  try { await fs.access(path.join(ROOT, relative)); return true; } catch { return false; }
}

function replaceControlled(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Could not locate ${label}; refusing Step 11 entity rewrite.`);
  return source.replace(before, after);
}

function jsonLdObjects(source) {
  const matches = [...source.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  return matches.map(match => JSON.parse(match[1]));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function patchHomepage(changed) {
  const relative = 'index.html';
  const before = await read(relative);
  const after = replaceControlled(before, LEGACY_CONTACT_PARAGRAPH, CONTACT_PARAGRAPH, 'legacy homepage contact paragraph');
  await writeIfChanged(relative, before, after, changed);
}

async function patchPolicies(changed) {
  const relative = 'policies.html';
  const before = await read(relative);
  let after = before;
  after = after.replace('<html lang="en">', '<html lang="en-PK">');
  const schemaPattern = /<script type="application\/ld\+json">[\s\S]*?<\/script>/;
  if (!schemaPattern.test(after)) throw new Error('Could not locate policies structured data; refusing Step 11 entity rewrite.');
  after = after.replace(schemaPattern, policySchemaScript);
  after = after.replace('href="favicon.svg"', 'href="/favicon.svg"');
  after = after.replaceAll('href="index.html#', 'href="/#');
  after = after.replaceAll('href="index.html"', 'href="/"');
  after = after.replace('>Al Huma</a><br />Instagram:', '>Al Huma Collection</a><br />Instagram:');
  await writeIfChanged(relative, before, after, changed);
}

async function patchGeneratedPage(relative, changed) {
  const before = await read(relative);
  if (before.includes(GENERATED_BRAND)) return;
  if (before.includes(LEGACY_GENERATED_BRAND)) {
    await writeIfChanged(relative, before, before.replace(LEGACY_GENERATED_BRAND, GENERATED_BRAND), changed);
    return;
  }
  if (isNoindexRedirect(before)) return;
  throw new Error(`Could not locate ${relative} generated textual AH brand placeholder; refusing Step 11 entity rewrite.`);
}

async function htmlFilesUnder(relative) {
  const root = path.join(ROOT, relative);
  const found = [];
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name === 'index.html') found.push(path.relative(ROOT, full).replaceAll('\\', '/'));
    }
  }
  if (await exists(relative)) await walk(root);
  return found;
}

async function patchGenerated(changed) {
  const catalogue = JSON.parse(await read('catalogue/dawood-products.json'));
  const products = Array.isArray(catalogue.products) ? catalogue.products : [];
  if (products.length < 20) throw new Error(`Step 11 refused: only ${products.length} active catalogue products found.`);

  for (const item of products) {
    const relative = productPageFile(item);
    if (!relative.startsWith('products/') || !await exists(relative)) throw new Error(`Active product page missing for ${item.code}: ${relative}`);
    await patchGeneratedPage(relative, changed);
  }

  for (const directory of ['collections', 'shop', 'guides']) {
    for (const relative of await htmlFilesUnder(directory)) await patchGeneratedPage(relative, changed);
  }
  return products;
}

function validateOrganization(entity, label) {
  const types = Array.isArray(entity?.['@type']) ? entity['@type'] : [entity?.['@type']];
  assert(types.includes('Organization') && types.includes('ClothingStore'), `${label}: Organization/ClothingStore type mismatch.`);
  assert(entity['@id'] === ORGANIZATION_ID, `${label}: organization @id mismatch.`);
  assert(entity.name === SITE_NAME, `${label}: organization name mismatch.`);
  assert(entity.url === `${BASE}/`, `${label}: organization URL mismatch.`);
  assert(entity.logo === LOGO_URL, `${label}: organization logo mismatch.`);
  assert(entity.email === EMAIL, `${label}: organization email mismatch.`);
  assert(entity.telephone === PHONE, `${label}: organization telephone mismatch.`);
  assert(entity.currenciesAccepted === 'PKR', `${label}: currenciesAccepted mismatch.`);
  assert(entity.address?.streetAddress === '87 Peer, Muradia Rd, Model Town', `${label}: streetAddress mismatch.`);
  assert(entity.address?.addressLocality === 'Sialkot', `${label}: addressLocality mismatch.`);
  assert(entity.address?.addressRegion === 'Punjab', `${label}: addressRegion mismatch.`);
  assert(entity.address?.addressCountry === 'PK', `${label}: addressCountry mismatch.`);
  assert(Array.isArray(entity.sameAs) && entity.sameAs.includes(FACEBOOK) && entity.sameAs.includes(INSTAGRAM), `${label}: social identity mismatch.`);
  for (const unsupported of ['openingHours', 'geo', 'aggregateRating', 'founder']) assert(!(unsupported in entity), `${label}: unsupported local/entity property present: ${unsupported}.`);
}

async function validate(products) {
  assert(await exists('assets/alhuma-collection-logo.webp'), 'Official Al Huma logo asset is missing.');

  const homepage = await read('index.html');
  assert(homepage.includes(CONTACT_PARAGRAPH), 'Homepage factual Sialkot business description is missing.');
  assert(!homepage.includes(LEGACY_CONTACT_PARAGRAPH), 'Homepage still contains the obsolete three-piece-only contact description.');
  assert(homepage.includes(`href="${FACEBOOK}"`), 'Homepage Facebook identity is missing.');
  assert(homepage.includes(`href="${INSTAGRAM}"`), 'Homepage Instagram identity is missing.');
  assert(homepage.includes(`href="mailto:${EMAIL}"`), 'Homepage official email is missing.');
  assert(homepage.includes(`href="https://wa.me/${PHONE.replace('+', '')}"`), 'Homepage official WhatsApp link is missing.');
  assert(homepage.includes('87 Peer, Muradia Rd'), 'Homepage official address is missing.');
  const homepageJson = jsonLdObjects(homepage);
  const homepageGraph = homepageJson.find(value => Array.isArray(value?.['@graph']))?.['@graph'] || [];
  const homepageOrg = homepageGraph.find(value => value?.['@id'] === ORGANIZATION_ID);
  const homepageWebsite = homepageGraph.find(value => value?.['@id'] === WEBSITE_ID);
  validateOrganization(homepageOrg, 'Homepage');
  assert(homepageWebsite?.publisher?.['@id'] === ORGANIZATION_ID, 'Homepage WebSite publisher does not resolve to the stable organization.');

  const policies = await read('policies.html');
  assert(policies.includes('<html lang="en-PK">'), 'Policies language is not normalized to en-PK.');
  assert(policies.includes(`<link rel="canonical" href="${BASE}/policies.html"`), 'Policies canonical mismatch.');
  assert(!policies.includes('href="index.html'), 'Policies still contains non-canonical index.html internal links.');
  assert(policies.includes(`href="${FACEBOOK}">Al Huma Collection</a>`), 'Policies Facebook name/URL mismatch.');
  assert(policies.includes(`href="${INSTAGRAM}"`), 'Policies Instagram identity mismatch.');
  assert(policies.includes(`href="mailto:${EMAIL}"`), 'Policies email mismatch.');
  assert(policies.includes(`href="https://wa.me/${PHONE.replace('+', '')}">${PHONE_DISPLAY}</a>`), 'Policies WhatsApp mismatch.');
  assert(policies.includes(`Address: ${ADDRESS_TEXT}.`), 'Policies visible address mismatch.');
  const policiesOrg = jsonLdObjects(policies).find(value => value?.['@id'] === ORGANIZATION_ID);
  validateOrganization(policiesOrg, 'Policies');
  assert(policiesOrg?.hasMerchantReturnPolicy?.merchantReturnLink === `${BASE}/policies.html#exchange-returns`, 'Policies merchant return link mismatch.');

  let productPagesChecked = 0;
  let pricedSellerRefs = 0;
  for (const item of products) {
    const relative = productPageFile(item);
    const page = await read(relative);
    assert(page.includes(GENERATED_BRAND), `${relative}: official brand header is missing.`);
    assert(!page.includes('<b>AH</b>'), `${relative}: obsolete textual AH placeholder remains.`);
    assert(page.includes(`<footer><p><strong>${SITE_NAME}</strong><br>87 Peer, Muradia Rd, Model Town, Sialkot, Pakistan</p>`), `${relative}: generated footer business identity mismatch.`);
    if (item.price != null && Number.isFinite(Number(item.price))) {
      assert(page.includes(`"seller":{"@id":"${ORGANIZATION_ID}"}`), `${relative}: priced Product seller does not resolve to the stable organization.`);
      pricedSellerRefs += 1;
    }
    productPagesChecked += 1;
  }

  let collectionPagesChecked = 0;
  let collectionRedirectsSkipped = 0;
  for (const relative of await htmlFilesUnder('collections')) {
    const page = await read(relative);
    if (isNoindexRedirect(page)) {
      collectionRedirectsSkipped += 1;
      continue;
    }
    assert(page.includes(GENERATED_BRAND), `${relative}: official brand header is missing.`);
    assert(!page.includes('<b>AH</b>'), `${relative}: obsolete textual AH placeholder remains.`);
    assert(page.includes(`"isPartOf":{"@id":"${WEBSITE_ID}"}`), `${relative}: CollectionPage WebSite relationship mismatch.`);
    assert(page.includes(`"publisher":{"@id":"${ORGANIZATION_ID}"}`), `${relative}: CollectionPage publisher relationship mismatch.`);
    collectionPagesChecked += 1;
  }

  let shopPagesChecked = 0;
  for (const relative of await htmlFilesUnder('shop')) {
    const page = await read(relative);
    assert(page.includes(GENERATED_BRAND), `${relative}: official brand header is missing.`);
    assert(!page.includes('<b>AH</b>'), `${relative}: obsolete textual AH placeholder remains.`);
    assert(page.includes(`"isPartOf":{"@id":"${WEBSITE_ID}"}`), `${relative}: CollectionPage WebSite relationship mismatch.`);
    assert(page.includes(`"publisher":{"@id":"${ORGANIZATION_ID}"}`), `${relative}: CollectionPage publisher relationship mismatch.`);
    shopPagesChecked += 1;
  }

  const guide = await read('guides/how-to-read-unstitched-suit-listings/index.html');
  assert(guide.includes(GENERATED_BRAND), 'Step 9B guide official brand header is missing.');
  assert(!guide.includes('<b>AH</b>'), 'Step 9B guide still contains the obsolete textual AH placeholder.');
  assert(guide.includes(`"isPartOf":{"@id":"${WEBSITE_ID}"}`), 'Step 9B guide WebSite relationship mismatch.');
  assert(guide.includes(`"publisher":{"@id":"${ORGANIZATION_ID}"}`), 'Step 9B guide publisher relationship mismatch.');

  const sitemapIndex = await read('sitemap.xml');
  const sitemapPages = await read('sitemap-pages.xml');
  assert(!sitemapIndex.includes('https://www.alhumacollection.com'), 'Sitemap index contains non-canonical www origin.');
  assert(!sitemapPages.includes('https://www.alhumacollection.com'), 'Page sitemap contains non-canonical www origin.');
  assert(sitemapPages.includes(`${BASE}/policies.html`), 'Policies URL is missing from sitemap-pages.xml.');
  assert(sitemapPages.includes(`${BASE}/guides/how-to-read-unstitched-suit-listings/`), 'Step 9B guide is missing from sitemap-pages.xml.');

  return {
    ok: true,
    products: products.length,
    productPagesChecked,
    pricedSellerRefs,
    collectionPagesChecked,
    collectionRedirectsSkipped,
    shopPagesChecked,
    guidePagesChecked: 1,
    organizationId: ORGANIZATION_ID,
    websiteId: WEBSITE_ID,
    officialLogo: '/assets/alhuma-collection-logo.webp',
    canonicalOrigin: BASE,
    unsupportedLocalAttributesAdded: false
  };
}

async function main() {
  const changed = [];
  await patchHomepage(changed);
  await patchPolicies(changed);
  const products = await patchGenerated(changed);
  const summary = await validate(products);
  console.log(JSON.stringify({ ...summary, changedFiles: changed.length }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
