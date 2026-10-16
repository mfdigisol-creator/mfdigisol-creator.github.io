import assert from 'node:assert/strict';
import {
  classifyBusinessGroup,
  classifyEmbroidery,
  classifyPieceType,
  classifyProduct,
  classifyScope,
  deriveCanonicalRelations,
  extractSeasons,
  hasGarmentSizes
} from './dawood-taxonomy.mjs';

const collection = (title, handle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')) => ({ id: handle, title, handle, products_count: 10 });
const product = (overrides = {}) => ({
  id: 1,
  title: 'Sample Digital Printed Khaddar 3PC',
  handle: 'sample',
  body_html: '<p>Printed shirt, trouser and dupatta fabric.</p>',
  vendor: 'Sample Brand',
  product_type: '3-PC',
  tags: ['3-PC', 'printed'],
  variants: [{ id: 10, title: '1', sku: 'SAMPLE-01', price: '2500.00', available: true }],
  images: [{ id: 20, src: 'https://cdn.shopify.com/sample.jpg' }],
  options: [{ name: 'Design', values: ['1'] }],
  ...overrides
});

assert.equal(classifyScope(product(), [collection('Winter 2026')]).status, 'included');
assert.equal(classifyScope(product({ tags:['3-PC','mens','winter2027'] }), [collection("Men's Winter")]).status, 'excluded');

const rtw = product({
  title:'Khaadi Plain Embroidered Stitched Lawn 3PC',
  tags:['3-PC','Lawn2026'],
  options:[{ name:'Size', values:['XS','S','M','L','XL'] }],
  variants:['XS','S','M','L','XL'].map((size,index)=>({ id:100+index,title:size,sku:`RTW-${size}`,price:'8400.00',available:true }))
});
assert.equal(hasGarmentSizes(rtw), true);
assert.equal(classifyScope(rtw, [collection('Ready To Wear')]).status, 'excluded');

const stitchedSleeves = product({
  title:'Sukhaina By Anaya Noor Fully Emb Slub Marina 3PC',
  body_html:'<p>Fully embroidered front. Stitched sleeves embroidered. Printed wool shawl. Plain trouser fabric.</p>',
  tags:['3-PC','embroidered','winter2027']
});
assert.equal(classifyScope(stitchedSleeves, [collection('Unstitched Winter Embroidered 3PC')]).status, 'included');

const shawlOnly = product({ title:'Limelight Winter Woolen Shawl', product_type:'1-PC', tags:['1-PC','winter2027'] });
assert.equal(classifyScope(shawlOnly, [collection('Winter Woolen Shawl')]).status, 'excluded');

const sparse = product({ title:'Mystery Product', body_html:'', product_type:'', tags:[], options:[{name:'Design',values:['1']} ] });
assert.equal(classifyScope(sparse, []).status, 'ambiguous');

const luxury = product({ title:'Luxury Embroidered Karandi 3PC', tags:['3-PC','embroidered'] });
assert.equal(classifyBusinessGroup(luxury, [collection('Luxury Winter')]), 'Luxury');
assert.equal(classifyEmbroidery(luxury, [collection('Luxury Winter')]), 'embroidered');
assert.equal(classifyPieceType(luxury), '3 Piece');
assert.deepEqual(extractSeasons(luxury, [collection('Luxury Winter')]), ['Winter']);

const genericWinter = classifyProduct(product({
  title:'Mahnur Emb Dhanak 3PC',
  tags:['3-PC','embroidered','winter2027']
}), [collection('WINTER 2026')]);
assert.equal(genericWinter.status, 'included');
assert.equal(genericWinter.category, 'Formal');
assert.equal(genericWinter.pricingClass, 'embroidered');
assert.deepEqual(genericWinter.seasons, ['Winter']);

const plain = classifyProduct(product({
  title:'Kayseria Digital Printed Khaddar 2PC',
  product_type:'2-PC',
  tags:['2-PC','printed','winter2027']
}), [collection('Winter 2026')]);
assert.equal(plain.status, 'included');
assert.equal(plain.pieceType, '2 Piece');
assert.equal(plain.pricingClass, 'non-embroidered');

const sourceCollection = (id, title, handle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')) => ({ id: String(id), title, handle });
const relationProduct = (id, brand, sourceCollections, overrides = {}) => ({
  id: String(id),
  code: `CODE-${id}`,
  name: `Name ${id}`,
  brand,
  available: true,
  sourceCollection: 'UNCHANGED PRIMARY',
  sourceCollectionHandle: 'unchanged-primary',
  sourceCollections,
  ...overrides
});

const fiona = sourceCollection(100, 'Fiona');
const newArrival = sourceCollection(101, 'New Arrival', 'new-arrival');
const winter = sourceCollection(102, 'WINTER 2026', 'winter-2026');
const brandOnly = sourceCollection(103, 'Sample Brand', 'sample-brand');
const mapped = deriveCanonicalRelations([
  relationProduct(1, 'Sample Brand', [fiona, newArrival, winter, brandOnly]),
  relationProduct(2, 'Sample Brand', [fiona, newArrival, winter, brandOnly]),
  relationProduct(3, 'Sample Brand', [fiona, newArrival, winter, brandOnly])
]);
assert.equal(mapped.products.every(item => item.relationKey === 'dawood_collection:100'), true);
assert.equal(mapped.products.every(item => item.sourceCollection === 'UNCHANGED PRIMARY'), true);
assert.equal(mapped.diagnostics.relationGroupsWith3PlusProducts, 1);
assert.equal(mapped.diagnostics.groups[0].products, 3);
assert.ok(mapped.diagnostics.genericCollectionsRejected >= 3);

const multiBrand = sourceCollection(200, 'Fiona');
const mixed = deriveCanonicalRelations([
  relationProduct(10, 'Brand A', [multiBrand]),
  relationProduct(11, 'Brand A', [multiBrand]),
  relationProduct(12, 'Brand B', [multiBrand])
]);
assert.equal(mixed.products.every(item => item.relationKey === null), true);
assert.equal(mixed.diagnostics.multiBrandCollectionsRejected, 1);

const broad = sourceCollection(300, 'House Edit');
const narrow = sourceCollection(301, 'Fiona');
const nested = deriveCanonicalRelations([
  relationProduct(20, 'Brand A', [broad, narrow]),
  relationProduct(21, 'Brand A', [broad, narrow]),
  relationProduct(22, 'Brand A', [broad, narrow]),
  relationProduct(23, 'Brand A', [broad]),
  relationProduct(24, 'Brand A', [broad])
]);
assert.equal(nested.products.find(item => item.id === '20').relationKey, 'dawood_collection:301');
assert.equal(nested.products.find(item => item.id === '23').relationKey, 'dawood_collection:300');

const overlapA = sourceCollection(400, 'Fiona');
const overlapB = sourceCollection(401, 'Nilofer');
const overlap = deriveCanonicalRelations([
  relationProduct(30, 'Brand A', [overlapA]),
  relationProduct(31, 'Brand A', [overlapA]),
  relationProduct(32, 'Brand A', [overlapA, overlapB]),
  relationProduct(33, 'Brand A', [overlapB]),
  relationProduct(34, 'Brand A', [overlapB])
]);
assert.equal(overlap.products.find(item => item.id === '32').relationKey, null);
assert.equal(overlap.diagnostics.ambiguousRelationProducts, 1);

const equivalentA = sourceCollection(500, 'Fiona');
const equivalentB = sourceCollection(499, 'Fiona Mirror');
const equivalent = deriveCanonicalRelations([
  relationProduct(40, 'Brand A', [equivalentA, equivalentB]),
  relationProduct(41, 'Brand A', [equivalentA, equivalentB]),
  relationProduct(42, 'Brand A', [equivalentA, equivalentB])
]);
assert.equal(equivalent.products.every(item => item.relationKey === 'dawood_collection:499'), true);

const tooSmall = sourceCollection(600, 'Fiona');
const undersized = deriveCanonicalRelations([
  relationProduct(50, 'Brand A', [tooSmall]),
  relationProduct(51, 'Brand A', [tooSmall])
]);
assert.equal(undersized.products.every(item => item.relationKey === null), true);
assert.equal(undersized.diagnostics.undersizedCollectionsRejected, 1);

const anomaly = sourceCollection(700, 'Fiona');
const anomalous = deriveCanonicalRelations([
  relationProduct(60, 'Brand A', [anomaly]),
  relationProduct(61, 'Brand A', [anomaly]),
  relationProduct(62, 'Brand A', [anomaly])
], { collectionAnomalies: [{ id: '700', handle: 'fiona' }] });
assert.equal(anomalous.products.every(item => item.relationKey === null), true);
assert.equal(anomalous.diagnostics.anomalyCollectionsRejected, 1);

const titleSkuTrap = sourceCollection(800, 'WINTER 2026', 'winter-2026');
const noInference = deriveCanonicalRelations([
  relationProduct(70, 'Brand A', [titleSkuTrap], { code: 'SAME-FAMILY-01', name: 'Fiona Design 1' }),
  relationProduct(71, 'Brand A', [titleSkuTrap], { code: 'SAME-FAMILY-02', name: 'Fiona Design 2' }),
  relationProduct(72, 'Brand A', [titleSkuTrap], { code: 'SAME-FAMILY-03', name: 'Fiona Design 3' })
]);
assert.equal(noInference.products.every(item => item.relationKey === null), true);

const brandTitleDescriptiveHandle = sourceCollection(900, 'BAREEZE', 'bareeze-digital-classic-printed-lawn-3pc');
const brandTitleRejected = deriveCanonicalRelations([
  relationProduct(80, 'Bareeze', [brandTitleDescriptiveHandle]),
  relationProduct(81, 'Bareeze', [brandTitleDescriptiveHandle]),
  relationProduct(82, 'Bareeze', [brandTitleDescriptiveHandle])
]);
assert.equal(brandTitleRejected.products.every(item => item.relationKey === null), true);

const ddBrandTitle = sourceCollection(901, 'DD-SHANAYA', 'dd-shanya');
const ddBrandRejected = deriveCanonicalRelations([
  relationProduct(83, 'Shanaya', [ddBrandTitle]),
  relationProduct(84, 'Shanaya', [ddBrandTitle]),
  relationProduct(85, 'Shanaya', [ddBrandTitle])
]);
assert.equal(ddBrandRejected.products.every(item => item.relationKey === null), true);

const broadLuxuryBrand = sourceCollection(902, 'LUXURY TAWAKKAL', 'luxury-tawakakl');
const broadLuxuryRejected = deriveCanonicalRelations([
  relationProduct(86, 'Tawakkal', [broadLuxuryBrand]),
  relationProduct(87, 'Tawakkal', [broadLuxuryBrand]),
  relationProduct(88, 'Tawakkal', [broadLuxuryBrand])
]);
assert.equal(broadLuxuryRejected.products.every(item => item.relationKey === null), true);

const volumeBucket = sourceCollection(903, 'Anaya Vol -1', 'anaya-vol-1');
const volumeRejected = deriveCanonicalRelations([
  relationProduct(89, 'Mahnur', [volumeBucket]),
  relationProduct(90, 'Mahnur', [volumeBucket]),
  relationProduct(91, 'Mahnur', [volumeBucket])
]);
assert.equal(volumeRejected.products.every(item => item.relationKey === null), true);

console.log('Dawood taxonomy tests passed: scope/pricing taxonomy + canonical relation-family scenarios.');
