import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const notes = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function localFileForUrl(urlString) {
  const url = new URL(urlString);
  if (url.origin !== 'https://alhumacollection.com') return null;
  if (url.pathname === '/') return path.join(root, 'index.html');
  if (url.pathname.endsWith('/')) return path.join(root, url.pathname.slice(1), 'index.html');
  return path.join(root, url.pathname.slice(1));
}

function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].replaceAll('&amp;', '&'));
}

function jsonLdObjects(html) {
  const objects = [];
  for (const match of html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { objects.push(JSON.parse(match[1])); } catch { /* General catalogue validation handles malformed JSON-LD. */ }
  }
  return objects;
}

function hasType(value, type) {
  if (!value) return false;
  if (Array.isArray(value)) return value.includes(type);
  return value === type;
}

function findType(objects, type) {
  for (const object of objects) {
    if (hasType(object?.['@type'], type)) return object;
    if (Array.isArray(object?.['@graph'])) {
      const found = object['@graph'].find(item => hasType(item?.['@type'], type));
      if (found) return found;
    }
  }
  return null;
}

const analyticsConfig = read('analytics-config.js');
const analytics = read('analytics.js');
const catalogueRuntime = read('dawood-catalogue.js');
const commerce = read('dawood-commerce.js');
const ordersConfig = read('orders-config.js');
const confirmed = read('order-confirmed.html');
const catalogue = JSON.parse(read('catalogue/dawood-products.json'));
const productsByCode = new Map(catalogue.products.map(product => [String(product.code), product]));

const gtm = analyticsConfig.match(/gtmId:\s*['"]([^'"]+)['"]/)?.[1] || '';
const ga4 = analyticsConfig.match(/ga4MeasurementId:\s*['"]([^'"]+)['"]/)?.[1] || '';
const pixel = analyticsConfig.match(/metaPixelId:\s*['"]([^'"]+)['"]/)?.[1] || '';
assert(/^GTM-[A-Z0-9]+$/i.test(gtm), 'analytics-config.js must contain a valid GTM container ID');
assert(/^G-[A-Z0-9]+$/i.test(ga4), 'analytics-config.js must contain a valid GA4 measurement ID');
assert(/^\d{5,20}$/.test(pixel), 'analytics-config.js must contain a valid Meta Pixel ID');
assert(/currency:\s*['"]PKR['"]/.test(analyticsConfig), 'Analytics currency must remain PKR');
assert(/debug:\s*false/.test(analyticsConfig), 'Production analytics debug mode must remain disabled');
assert(!/test_event_code\s*:\s*['"][^'"]+['"]/.test(analyticsConfig), 'Production analytics config must not hard-code a Meta test event code');

assert(analytics.includes("consentCommand('default',consent || {analytics:false,marketing:false})"), 'Optional analytics and advertising storage must default to denied');
assert(analytics.includes("const PRODUCTION_HOSTS = new Set(['alhumacollection.com','www.alhumacollection.com']);"), 'External measurement must be restricted to the approved production hosts');
assert(analytics.includes("const TEST_CONTEXT_KEY = 'alhuma-measurement-test-context';"), 'Measurement QA/test context must persist for the current browser session');
assert(analytics.includes("const TEST_REFERRER_HOSTS = new Set(['tagassistant.google.com','eventsmanager.facebook.com']);"), 'Known Tag Assistant and Events Manager QA referrals must be classified as test contexts');
assert(analytics.includes('const detected=Boolean(metaTestEventCode()) || TEST_REFERRER_HOSTS.has(referrerHost);'), 'Existing test_event_code and known QA referrals must suppress external measurement');
assert(analytics.includes("if(detected) sessionStorage.setItem(TEST_CONTEXT_KEY,'1');"), 'Detected measurement test context must persist across same-session navigation');
assert(analytics.includes('return PRODUCTION_HOSTS.has(location.hostname.toLowerCase()) && !measurementTestContext();'), 'External measurement must require an approved production hostname and a non-test context');
assert(analytics.includes('if(!externalMeasurementAllowed() || !valid.endpoint(config.metaCapiEndpoint))return;'), 'Browser CAPI delivery must be blocked outside approved production measurement contexts');
assert(analytics.includes('if(!consent?.marketing || !eventName || !externalMeasurementAllowed())return;'), 'Meta browser/server delivery must be blocked outside approved production measurement contexts');
assert(analytics.includes('if (consent?.analytics || consent?.marketing) dataLayer.push(payload);'), 'Local dataLayer measurement payloads must remain available for functional QA');
assert(analytics.includes('if (consent?.analytics && externalMeasurementAllowed() && !valid.gtm(config.gtmId) && valid.ga4(config.ga4MeasurementId) && window.gtag)'), 'Direct GA4 fallback delivery must be blocked outside approved production measurement contexts');
assert(analytics.includes('const allowExternal=externalMeasurementAllowed();'), 'Integration loading must evaluate the external-measurement isolation guard');
assert(analytics.includes('if(allowExternal && consent.analytics && valid.gtm(config.gtmId))'), 'GTM loading must require analytics consent and an approved production measurement context');
assert(analytics.includes('else if(allowExternal && consent.analytics && valid.ga4(config.ga4MeasurementId))'), 'Direct GA4 fallback loading must require analytics consent and an approved production measurement context');
assert(analytics.includes('if(allowExternal && consent.marketing && valid.meta(config.metaPixelId))'), 'Meta Pixel loading must require marketing consent and an approved production measurement context');
assert(analytics.includes('// Page-level analytics events are independent of advertising consent.'), 'Configured page events must document independent analytics-consent handling');
assert(analytics.includes('if(consent.analytics || consent.marketing) trackConfiguredPageEvent();'), 'Configured page events must remain locally trackable for analytics consent even when external delivery is suppressed');
assert((analytics.match(/sendMetaEvent\('PageView'/g) || []).length === 1, 'Meta PageView must have one source path to avoid client duplication');
notes.push('External GA4/GTM/Meta/CAPI delivery is limited to alhumacollection.com / www.alhumacollection.com and suppressed for persisted test_event_code, Tag Assistant and Events Manager QA contexts.');
notes.push('Local dataLayer/custom-event behavior remains available in suppressed contexts so functional QA can inspect measurement without polluting external production analytics.');

assert(catalogueRuntime.includes("track('view_item'"), 'Dynamic catalogue must emit view_item');
assert(/track\(isSearch\s*&&\s*control\.value\.trim\(\)\s*\?\s*['"]search['"]\s*:\s*['"]filter_catalogue['"]/.test(catalogueRuntime), 'Dynamic catalogue must emit search for non-empty search input');
assert(commerce.includes("track('add_to_cart'"), 'Commerce runtime must emit add_to_cart');
assert(commerce.includes("track('begin_checkout'"), 'Commerce runtime must emit begin_checkout');
assert(commerce.includes("track('generate_lead'"), 'Secure/legacy order registration must emit generate_lead');
assert(!commerce.includes("track('add_payment_info'"), 'Cash on Delivery flow must not fabricate add_payment_info');
notes.push('add_payment_info is intentionally not emitted because the current checkout is Cash on Delivery and collects no payment instrument.');

const clientPurchasePattern = /(?:track\s*\(\s*['"]purchase['"]|meta_event\s*:\s*['"]Purchase['"]|event\s*:\s*['"]purchase['"])/i;
for (const [name, source] of [['analytics.js', analytics], ['dawood-catalogue.js', catalogueRuntime], ['dawood-commerce.js', commerce], ['order-confirmed.html', confirmed]]) {
  assert(!clientPurchasePattern.test(source), `${name} must not emit a client-side Purchase event`);
}
assert(/noindex/.test(confirmed), 'order-confirmed.html must remain noindex');
assert(confirmed.includes('analytics-config.js') && confirmed.includes('analytics.js'), 'order-confirmed.html must retain consent-aware analytics runtime');
assert(confirmed.includes('sessionStorage') && confirmed.includes('alhuma-order-confirmation'), 'Order confirmation page must remain guarded by a short-lived session marker');
assert(/mode:\s*['"]production['"]/.test(ordersConfig), 'Storefront orders client must remain in production mode');
assert(/endpoint:\s*['"]https:\/\/orders-api\.alhumacollection\.com\/v1\/orders['"]/.test(ordersConfig), 'Storefront orders endpoint must remain on the production canonical hostname');
assert(/debug:\s*false/.test(ordersConfig), 'Production orders debug mode must remain disabled');

const indexableUrls = new Set([
  ...sitemapUrls(read('sitemap-pages.xml')),
  ...sitemapUrls(read('catalogue/products-sitemap.xml'))
]);
let measuredIndexablePages = 0;
for (const url of indexableUrls) {
  const file = localFileForUrl(url);
  if (!file || !fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  assert(html.includes('analytics-config.js') && html.includes('analytics.js'), `Indexable page is missing the consent-aware analytics runtime: ${url}`);
  if (html.includes('analytics-config.js') && html.includes('analytics.js')) measuredIndexablePages += 1;
}

const activeProductUrls = [...indexableUrls].filter(url => new URL(url).pathname.startsWith('/products/'));
let pricedPageEvents = 0;
let enquiryPageEvents = 0;
let unavailablePageEvents = 0;
for (const url of activeProductUrls) {
  const file = localFileForUrl(url);
  assert(file && fs.existsSync(file), `Active product sitemap URL has no generated HTML: ${url}`);
  if (!file || !fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  const eventMatch = html.match(/<script>window\.AL_HUMA_PAGE_EVENT=([\s\S]*?)<\/script>/);
  assert(eventMatch, `Active product page is missing AL_HUMA_PAGE_EVENT: ${url}`);
  if (!eventMatch) continue;
  let pageEvent;
  try { pageEvent = JSON.parse(eventMatch[1]); } catch { errors.push(`Invalid AL_HUMA_PAGE_EVENT JSON: ${url}`); continue; }
  const productSchema = findType(jsonLdObjects(html), 'Product');
  assert(productSchema, `Active product page is missing Product JSON-LD: ${url}`);
  if (!productSchema) continue;
  const code = String(productSchema.sku || '');
  const sourceProduct = productsByCode.get(code);
  assert(sourceProduct, `Product schema SKU is not present in synchronized catalogue: ${code || url}`);
  assert(pageEvent.event === 'view_item', `Product page event must be view_item: ${code}`);
  assert(pageEvent.params?.currency === 'PKR', `Product page event currency must be PKR: ${code}`);
  assert(Array.isArray(pageEvent.params?.content_ids) && pageEvent.params.content_ids.length === 1 && String(pageEvent.params.content_ids[0]) === code, `Product page content_ids must contain the exact SKU: ${code}`);
  assert(Array.isArray(pageEvent.params?.items) && String(pageEvent.params.items[0]?.code || '') === code, `Product page item_id source must match SKU: ${code}`);
  if (sourceProduct) assert(Boolean(pageEvent.params?.availability) === Boolean(sourceProduct.available), `Product page event availability disagrees with synchronized catalogue: ${code}`);
  const offer = productSchema.offers;
  if (offer) {
    const schemaPrice = Number(offer.price);
    assert(Number.isFinite(schemaPrice), `Priced Product Offer must contain a numeric price: ${code}`);
    assert(Number(pageEvent.params?.value) === schemaPrice, `Product page event value must match Product Offer price: ${code}`);
    assert(offer.priceCurrency === 'PKR', `Product Offer priceCurrency must remain PKR: ${code}`);
    pricedPageEvents += 1;
    if (offer.availability === 'https://schema.org/OutOfStock') unavailablePageEvents += 1;
  } else {
    assert(pageEvent.params?.value == null, `Price-on-enquiry product page event must not invent a numeric value: ${code}`);
    enquiryPageEvents += 1;
  }
}

assert(activeProductUrls.length === Number(catalogue.counts?.products), `Active product sitemap count (${activeProductUrls.length}) must match catalogue count (${catalogue.counts?.products})`);
assert(pricedPageEvents === Number(catalogue.counts?.metaFeedProducts), `Priced product event count (${pricedPageEvents}) must match priced/feed population (${catalogue.counts?.metaFeedProducts})`);
assert(enquiryPageEvents === Number(catalogue.counts?.priceOnEnquiry), `Price-on-enquiry page event count (${enquiryPageEvents}) must match catalogue count (${catalogue.counts?.priceOnEnquiry})`);

const report = {
  ok: errors.length === 0,
  generatedAt: new Date().toISOString(),
  summary: {
    indexableUrls: indexableUrls.size,
    measuredIndexablePages,
    activeProductPages: activeProductUrls.length,
    pricedProductPageEvents: pricedPageEvents,
    enquiryProductPageEvents: enquiryPageEvents,
    unavailablePricedProductPageEvents: unavailablePageEvents,
    clientPurchaseEmitters: 0,
    errors: errors.length
  },
  measurement: {
    gtmContainerConfigured: Boolean(gtm),
    ga4FallbackConfigured: Boolean(ga4),
    metaPixelConfigured: Boolean(pixel),
    currency: 'PKR',
    addPaymentInfo: 'not_applicable_cod',
    purchaseAuthority: 'server-side only after backend order-status policy permits it',
    configuredPageEventIndependentOfAdvertisingConsent: true,
    externalMeasurementIsolation: {
      productionHosts: ['alhumacollection.com', 'www.alhumacollection.com'],
      nonProductionHostsBlocked: true,
      qaTestContextsBlocked: ['test_event_code', 'tagassistant.google.com', 'eventsmanager.facebook.com'],
      localDataLayerPreserved: true
    }
  },
  notes,
  errors
};
fs.writeFileSync(path.join(root, 'catalogue', 'analytics-measurement-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
