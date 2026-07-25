import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const analytics = read('analytics.js');
const config = read('analytics-config.js');
const generator = read('scripts/generate-seo-pages.mjs');
const homepage = read('index.html');
const generated = [
  ...fs.readdirSync('products').map(name => `products/${name}/index.html`),
  ...fs.readdirSync('collections').map(name => `collections/${name}/index.html`),
  ...fs.readdirSync('shop').map(name => `shop/${name}/index.html`)
];

const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(config.includes("metaCapiEndpoint: 'https://meta-capi.alhumacollection.workers.dev/events'"), 'CAPI endpoint is not configured');
assert(![analytics, config, generator, homepage].some(source => source.includes('META_ACCESS_TOKEN')), 'A secret variable name leaked into public website code');
assert(analytics.includes("window.fbq('track',eventName,metaCustomData(params),{eventID:id})"), 'Browser event_id mapping is missing');
assert(analytics.includes('sendServerEvent(eventName,id,params)'), 'Server event_id mapping is missing');
assert(analytics.includes("if(!consent?.marketing || !eventName)return"), 'Marketing-consent gate is missing');
assert(analytics.includes("credentials:'omit'"), 'CAPI request is not isolated from website credentials');
assert(analytics.includes("sendMetaEvent('PageView',eventId('PageView'))"), 'PageView browser/server event is missing');
assert(generator.includes('window.AL_HUMA_PAGE_EVENT='), 'Generated page event persistence is missing');
assert(generated.length === 1257, `Unexpected generated page count: ${generated.length}`);
for (const file of generated) {
  const html = read(file);
  assert(html.includes('/analytics-config.js?v=20260726-meta-capi-v1'), `Analytics config missing from ${file}`);
  assert(html.includes('/analytics.js?v=20260726-meta-capi-v1'), `Analytics runtime missing from ${file}`);
  if (file.startsWith('products/')) {
    assert(html.includes('window.AL_HUMA_PAGE_EVENT='), `ViewContent payload missing from ${file}`);
    assert(!html.match(/AL_HUMA_PAGE_EVENT=.*dawooddesigners/i), `Supplier source leaked into page event in ${file}`);
  }
}
assert(!/track\(['"]purchase['"]/i.test(analytics), 'Unverified Purchase tracking must remain disabled');
console.log(`Meta CAPI checks passed for ${generated.length} generated pages.`);
