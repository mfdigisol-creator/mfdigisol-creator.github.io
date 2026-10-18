// End-to-end projection parity: preserve every field used by homepage cards,
// product details, cart/analytics bridge, assistant and supplier filters.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {descriptionForProduct} from './product-description.mjs';
const full=JSON.parse(fs.readFileSync('catalogue/dawood-products.json','utf8'));
const slim=JSON.parse(fs.readFileSync('catalogue/dawood-browser-products.json','utf8'));
assert.equal(slim.schemaVersion,'browser-catalogue-1');
assert.equal(slim.synchronizedAt,full.synchronizedAt);
assert.deepEqual(slim.counts,full.counts);
assert.equal(slim.products.length,full.products.length);
const used=['code','name','productName','brand','category','sourceCollection',
  'seasons','pricingClass','pricingStatus','pieceType','sourceDescription',
  'price','available','image','images'];
const byCode=new Map(full.products.map(p=>[p.code,p]));
assert.equal(byCode.size,full.products.length);
for(const projected of slim.products){
  const original=byCode.get(projected.code);
  assert.ok(original, 'Unknown projected SKU '+projected.code);
  for(const field of used){
    assert.deepEqual(projected[field],original[field], 'Changed '+field+' on '+projected.code);
  }
  assert.deepEqual(projected.sourceCollections,
    original.sourceCollections.map(({title,handle})=>({title,handle})), 'Collection navigation changed');
  assert.deepEqual(descriptionForProduct(projected),descriptionForProduct(original),
    'Supplier description/fallback changed for '+projected.code);
}
const runtime=fs.readFileSync('dawood-catalogue.js','utf8');
assert.ok(runtime.includes("['dawood-browser-products.json', 'dawood-products.json']"), 'Browser-first fetch and full fallback missing');
assert.ok(runtime.includes("data.counts?.products !== data.products.length"),'Runtime missing payload count guard');
const a=gzipSync(fs.readFileSync('catalogue/dawood-products.json'),{level:6}).length;
const b=gzipSync(fs.readFileSync('catalogue/dawood-browser-products.json'),{level:6}).length;
assert.ok(b<a*.95,'Projected catalogue savings insufficient: '+a+' vs '+b);
console.log(JSON.stringify({ok:true,products:slim.products.length,
  fullGzipBytes:a,browserGzipBytes:b,savingsPct:+((a-b)/a*100).toFixed(2),
  fallback:'authoritative catalogue'},null,2));
