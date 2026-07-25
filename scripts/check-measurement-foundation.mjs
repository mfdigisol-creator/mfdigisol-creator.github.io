import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const analytics = read('analytics.js');
const catalogue = read('dawood-catalogue.js');
const commerce = read('dawood-commerce.js');
const index = read('index.html');
const installer = read('scripts/install-dawood-integration.mjs');
const config = read('analytics-config.js');
const requiredEvents = ['view_item','search','add_to_cart','begin_checkout','generate_lead','whatsapp_click','assistant_open','assistant_question','assistant_recommendation_click'];

for (const event of requiredEvents) {
  if (![analytics,catalogue,commerce].some(source => source.includes(`'${event}'`))) throw new Error(`Missing event: ${event}`);
}
if (!analytics.includes("analytics_storage:state.analytics?'granted':'denied'")) throw new Error('Analytics consent default/update is missing');
if (!analytics.includes("ad_storage:state.marketing?'granted':'denied'")) throw new Error('Advertising consent default/update is missing');
if (/track\(['"]purchase['"]/.test([analytics,catalogue,commerce].join('\n'))) throw new Error('Unverified Purchase tracking must not be enabled');
for (const id of ['GTM-NP995MF2','G-VP0WEM8CNC','1738280330535371']) {
  if (!config.includes(id)) throw new Error(`Missing public analytics identifier: ${id}`);
}
if (!config.includes('https://meta-capi.alhumacollection.workers.dev/events')) throw new Error('Missing Meta CAPI endpoint');
if (!analytics.includes("sendMetaEvent(params.meta_event,id,params)")) throw new Error('Browser/server event bridge is missing');
if (!analytics.includes("sendMetaEvent('PageView',eventId('PageView'))")) throw new Error('Deduplicated Meta PageView is missing');
if (!analytics.includes("credentials:'omit'")) throw new Error('CAPI request must not send website credentials');
if (analytics.includes('META_ACCESS_TOKEN') || config.includes('META_ACCESS_TOKEN')) throw new Error('Meta access token must never be present in website code');
if (!analytics.includes('Accept all optional')) throw new Error('Consent acceptance label must accurately cover analytics and advertising');
for (const asset of ['analytics-config.js','analytics.js','dawood-catalogue.js','dawood-commerce.js']) {
  const version = ['analytics-config.js','analytics.js'].includes(asset) ? '20260726-meta-capi-v1' : '20260722-measurement-foundation';
  if (!index.includes(`${asset}?v=${version}`)) throw new Error(`Homepage cache version missing: ${asset}`);
  if (!installer.includes(`${asset}?v=${version}`)) throw new Error(`Installer persistence missing: ${asset}`);
}
console.log('Measurement foundation checks passed.');
