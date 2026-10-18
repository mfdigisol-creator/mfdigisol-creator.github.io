// Generate a browser-only view. The full supplier catalogue remains authoritative
// for checkout validation, synchronized pricing, SEO, feeds and diagnostics.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const FULL = 'catalogue/dawood-products.json';
const BROWSER = 'catalogue/dawood-browser-products.json';
const root = JSON.parse(await fs.readFile(FULL, 'utf8'));
assert.ok(Array.isArray(root.products) && root.products.length >= 500, 'Authoritative catalogue missing or unexpectedly small');
assert.equal(root.counts?.products, root.products.length, 'Full catalogue count mismatch');

// These fields are consumed by dawood-catalogue.js, descriptionForProduct(),
// the cart, analytics and the assistant snapshot. Keep the original strings,
// image ordering, prices and productName used for canonical product links.
export const browserFields = [
  'code','name','productName','brand','category','sourceCollection',
  'seasons','pricingClass','pricingStatus','pieceType','sourceDescription',
  'price','available','image','images'
];
export function browserProduct(product) {
  const compact = {};
  for (const key of browserFields) {
    if (Object.hasOwn(product, key)) compact[key] = product[key];
  }
  // Storefront search and supplier-collection filters need only these two
  // collection properties; opaque Shopify collection IDs are not used.
  compact.sourceCollections = Array.isArray(product.sourceCollections)
    ? product.sourceCollections.map(collection => ({
      title: collection.title,
      handle: collection.handle
    }))
    : [];
  return compact;
}
const result = {
  schemaVersion: 'browser-catalogue-1',
  synchronizedAt: root.synchronizedAt,
  counts: root.counts,
  products: root.products.map(browserProduct)
};
const codes = new Set();
for (let i=0; i<root.products.length; i++) {
  const original = root.products[i], projected = result.products[i];
  assert.ok(original.code && original.name && original.image, 'Product missing required storefront data');
  assert.ok(!codes.has(original.code), 'Duplicate SKU in browser catalogue: '+original.code);
  codes.add(original.code);
  assert.equal(projected.code, original.code);
  assert.equal(projected.price, original.price);
  assert.equal(projected.available, original.available);
  assert.deepEqual(projected.images, original.images);
  assert.deepEqual(projected.seasons, original.seasons);
  assert.deepEqual(projected.sourceCollections.map(x=>({title:x.title,handle:x.handle})),
    original.sourceCollections.map(x=>({title:x.title,handle:x.handle})));
}
const fullContent = await fs.readFile(FULL);
const compactContent = JSON.stringify(result)+'\n';
const fullGzipBytes = gzipSync(fullContent,{level:6}).length;
const browserGzipBytes = gzipSync(compactContent,{level:6}).length;
assert.ok(browserGzipBytes < fullGzipBytes*0.95, 'Browser catalogue did not reduce compressed payload by at least 5%');
await fs.writeFile(BROWSER,compactContent,'utf8');
console.log(JSON.stringify({
  ok:true,source:FULL,output:BROWSER,products:result.products.length,
  sourceBytes:fullContent.length,browserBytes:Buffer.byteLength(compactContent),
  sourceGzipBytes:fullGzipBytes,browserGzipBytes,
  gzipSavingsPercent:+((1-browserGzipBytes/fullGzipBytes)*100).toFixed(2)
},null,2));
