import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveDuplicateSupplierPricing } from './duplicate-source-pricing.mjs';

const record = (sourceProductId, sourcePrice) => ({ sourceProductId: String(sourceProductId), sourcePrice });
const embroidered = resolveDuplicateSupplierPricing([record(1, 4120), record(2, 6060)], ['embroidered']);
assert.equal(embroidered.sourcePrice, 6060);
assert.equal(embroidered.price, 8560); // 6,060 + 2,500
assert.equal(embroidered.markup, 2500);
assert.equal(embroidered.priceSourceProductId, '2');
assert.equal(embroidered.pricingReason, 'duplicate-source-higher-price');

const plain = resolveDuplicateSupplierPricing([record(1, 2700), record(2, 3400)], ['non-embroidered']);
assert.equal(plain.sourcePrice, 3400);
assert.equal(plain.price, 4400); // 3,400 + 1,000
assert.equal(plain.markup, 1000);

const reversed = resolveDuplicateSupplierPricing([record(2, 6060), record(1, 4120)], ['embroidered']);
assert.deepEqual(reversed, embroidered);
const equalPrice = resolveDuplicateSupplierPricing([record(1, 5000), record(2, 5000)], ['embroidered']);
assert.equal(equalPrice.price, 7500);
assert.equal(equalPrice.pricingReason, null);

const ambiguous = resolveDuplicateSupplierPricing([record(1, 4120), record(2, 6060)], ['embroidered', 'non-embroidered']);
assert.equal(ambiguous.sourcePrice, 6060);
assert.equal(ambiguous.price, null);
assert.equal(ambiguous.pricingStatus, 'enquire');
assert.equal(ambiguous.pricingReason, 'duplicate-source-classification-conflict');
const unknown = resolveDuplicateSupplierPricing([record(1, 4120), record(2, 6060)], ['unknown']);
assert.equal(unknown.price, null);
assert.equal(unknown.pricingStatus, 'enquire');

const withInvalid = resolveDuplicateSupplierPricing([record(1, 4120), record(2, NaN), record(3, -500)], ['embroidered']);
assert.equal(withInvalid.sourcePrice, 4120);
assert.equal(withInvalid.price, 6620);
assert.throws(() => resolveDuplicateSupplierPricing([record(1, 0), record(2, NaN)], ['embroidered']), /no positive finite/);

// The --catalogue mode validates actual isolated supplier discovery and generated
// catalogue output in the GitHub Actions pull-request candidate workspace.
if (process.argv.includes('--catalogue')) {
  const drift = JSON.parse(fs.readFileSync('catalogue/dawood-drift-report.json', 'utf8'));
  const catalogue = JSON.parse(fs.readFileSync('catalogue/dawood-products.json', 'utf8'));
  const products = new Map(catalogue.products.map(item => [item.code, item]));
  const dupes = drift.duplicateSourceCodes || [];
  for (const entry of dupes) {
    const item = products.get(entry.code);
    assert.ok(item, `Missing duplicate SKU: ${entry.code}`);
    const highest = Math.max(...entry.sourcePrices);
    assert.equal(item.sourcePrice, highest, `Supplier price not highest: ${entry.code}`);
    assert.equal(entry.selectedSourcePrice, highest, `Audit price mismatch: ${entry.code}`);
    assert.ok(entry.sourceProductIds.includes(item.priceSourceProductId), `Missing price provenance: ${entry.code}`);
    const classes = entry.pricingClasses;
    const markup = classes.length === 1 && classes[0] === 'embroidered' ? 2500
      : classes.length === 1 && classes[0] === 'non-embroidered' ? 1000 : null;
    assert.equal(item.markup, markup, `Markup mismatch: ${entry.code}`);
    assert.equal(item.price, markup === null ? null : highest + markup, `Retail price mismatch: ${entry.code}`);
  }
  console.log(`Verified ${dupes.length} live-source duplicate supplier SKU price cases.`);
}
console.log('Duplicate supplier pricing policy tests passed.');
