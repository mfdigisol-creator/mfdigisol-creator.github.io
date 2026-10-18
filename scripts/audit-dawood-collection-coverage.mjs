// Read-only bounded reconciliation of Dawood's advertised collection counts
// against two independent Shopify Storefront pagination sizes. Does not write
// supplier content or change Al Huma's current catalogue / selection rules.
import fs from 'node:fs/promises';

const SOURCE = 'https://dawooddesigners.com';
const HANDLES = [
  'amelia', 'anaya-vol-1', 'anaya-vol-2', 'dd-shanya', 'gulzar',
  'kaia', 'pakeezah', 'summer-2026-untitched-daily-wear',
  'summer-trending-hit-codes', 'unstitched-daily-wear-embroidered-3pc',
  'unstitched-daily-wear-printed-3pc'
];
const MAX_REQUESTS = 75;
let requests = 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPage(handle, size, page) {
  if (++requests > MAX_REQUESTS) throw new Error('Audit request ceiling exceeded');
  const url = new URL(`/collections/${encodeURIComponent(handle)}/products.json`, SOURCE);
  url.searchParams.set('limit', String(size));
  url.searchParams.set('page', String(page));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'AlHumaReadOnlyCoverageAudit/1.0' }, signal: AbortSignal.timeout(25_000) });
    if (response.ok) {
      const json = await response.json();
      if (!Array.isArray(json.products)) throw new Error(`Expected products array from ${handle}`);
      return json.products;
    }
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) throw new Error(`HTTP ${response.status} for ${handle}, size=${size} page=${page}`);
    await sleep((attempt + 1) * 1500);
  }
}
async function fetchAll(handle, size, reported) {
  const ids = new Set();
  const maxPages = Math.min(6, Math.ceil(Math.max(reported, 1) / size) + 2);
  let completed = false;
  const pages = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await fetchPage(handle, size, page);
    pages.push(batch.length);
    for (const item of batch) {
      if (item?.id != null) ids.add(String(item.id));
    }
    if (batch.length < size) { completed = true; break; }
  }
  if (!completed) throw new Error(`Audit pagination not complete for ${handle} size=${size}`);
  return { count: ids.size, ids, pages };
}

const snap = JSON.parse(await fs.readFile('catalogue/dawood-taxonomy-snapshot.json', 'utf8'));
const collectionMap = new Map((snap.collections || []).map(x => [x.handle, x]));
const result = [];
for (const handle of HANDLES) {
  const base = collectionMap.get(handle);
  if (!base || base.productsCount > 150) throw new Error(`Unexpected missing/large audit collection: ${handle}`);
  const a = await fetchAll(handle, 250, base.productsCount);
  const b = await fetchAll(handle, 50, base.productsCount);
  const onlySmall = [...b.ids].filter(id => !a.ids.has(id));
  const onlyLarge = [...a.ids].filter(id => !b.ids.has(id));
  result.push({
    handle, reportedAtPriorSnapshot: base.productsCount, snapshotFetched: base.fetchedProducts,
    liveLimit250: a.count, liveLimit50: b.count, smallPageSizes: b.pages,
    additionalFoundWithSmallPages: onlySmall.length,
    missingFromSmallPages: onlyLarge.length,
    // IDs are supplier public data; show bounded samples only for investigation.
    additionalProductIds: onlySmall.slice(0, 6),
    stableAcrossPageSizes: onlySmall.length === 0 && onlyLarge.length === 0
  });
}
const summary = {
  collectionsChecked: result.length, totalRequests: requests, allPaginationStrategiesAgree: result.every(x => x.stableAcrossPageSizes),
  baselineReportedMemberships: result.reduce((n, x) => n + x.reportedAtPriorSnapshot, 0),
  live250Memberships: result.reduce((n, x) => n + x.liveLimit250, 0),
  live50Memberships: result.reduce((n, x) => n + x.liveLimit50, 0),
  collectionsWithAdditionalRetrievableProducts: result.filter(x => x.additionalFoundWithSmallPages > 0).map(x => x.handle)
};
console.log('COLLECTION_COVERAGE_AUDIT_BEGIN');
console.log(JSON.stringify({ summary, collections: result }, null, 2));
console.log('COLLECTION_COVERAGE_AUDIT_END');
