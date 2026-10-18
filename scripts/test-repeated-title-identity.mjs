import assert from 'node:assert/strict';
import fs from 'node:fs';

const catalogue = JSON.parse(fs.readFileSync('catalogue/dawood-products.json', 'utf8'));
const products = catalogue.products || [];
assert.ok(products.length > 50, 'Catalogue unexpectedly small');
const key = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const groups = new Map();
for (const product of products) {
  assert.ok(product.code && product.name, 'Missing SKU or name');
  const k = key(product.name);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(product);
}
const repeated = [...groups].filter(([, rows]) => rows.length > 1);
const count = (rows, fn) => new Set(rows.map(fn)).size;
const cards = fs.readFileSync('dawood-catalogue.js', 'utf8');
const css = fs.readFileSync('dawood-catalogue.css', 'utf8');
assert.ok(cards.includes('hasRepeatedName(product)'), 'Repeated-title detection missing in storefront');
assert.ok(cards.includes('Design code: ${escapeHtml(product.code)}'), 'Duplicate-title code indicator missing from product card');
assert.ok(cards.includes('repeatedNameKeys = new Set('), 'Repeated-title index missing');
assert.ok(css.includes('.live-product-unique-code'), 'Repeated-title code style missing');
assert.equal(count(products, p => p.code), products.length, 'Product codes not unique');
const summary = {
  products: products.length,
  repeatedTitleGroups: repeated.length,
  productsInRepeatedGroups: repeated.reduce((n,[,rows]) => n + rows.length, 0),
  sameSourceProductIdGroups: repeated.filter(([,rows]) => count(rows, p => p.sourceProductId) < rows.length).length,
  repeatedPrimaryImageUrlGroups: repeated.filter(([,rows]) => count(rows, p => (p.image || '').split('?')[0]) < rows.length).length,
  varyingSupplierPriceGroups: repeated.filter(([,rows]) => count(rows, p => p.sourcePrice) > 1).length
};
console.log(JSON.stringify(summary, null, 2));
console.log('Repeated-title SKU display validation passed; no product records changed.');
