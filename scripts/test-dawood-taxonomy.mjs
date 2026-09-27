import assert from 'node:assert/strict';
import {
  classifyBusinessGroup,
  classifyEmbroidery,
  classifyPieceType,
  classifyProduct,
  classifyScope,
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

console.log('Dawood taxonomy tests passed: 10/10 scenarios.');
