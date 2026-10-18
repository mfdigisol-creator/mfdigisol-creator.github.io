// Deterministic policy for multiple Dawood records sharing one SKU.
// Source prices are wholesale prices. Al Huma markup is applied after selecting
// the highest valid supplier price, never to the lower duplicate record.
export function resolveDuplicateSupplierPricing(items, pricingClasses) {
  const priced = items.filter(item => Number.isFinite(item.sourcePrice) && item.sourcePrice > 0);
  if (!priced.length) throw new Error('Duplicate supplier SKU has no positive finite source price.');

  const sourcePrices = [...new Set(priced.map(item => item.sourcePrice))].sort((a, b) => a - b);
  const sourcePrice = sourcePrices.at(-1);
  const highestPriceRecord = priced
    .filter(item => item.sourcePrice === sourcePrice)
    .sort((a, b) => String(a.sourceProductId).localeCompare(String(b.sourceProductId)))[0];
  const knownClass = pricingClasses.length === 1 ? pricingClasses[0] : null;
  const markup = knownClass === 'embroidered' ? 2500 : knownClass === 'non-embroidered' ? 1000 : null;
  const pricingReason = markup === null
    ? pricingClasses.length > 1 ? 'duplicate-source-classification-conflict' : 'classification-uncertain'
    : sourcePrices.length > 1 ? 'duplicate-source-higher-price' : null;

  return {
    sourcePrices,
    sourcePrice,
    priceSourceProductId: String(highestPriceRecord.sourceProductId),
    markup,
    price: markup === null ? null : sourcePrice + markup,
    pricingStatus: markup === null ? 'enquire' : 'calculated',
    pricingReason
  };
}
