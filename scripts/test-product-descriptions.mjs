import fs from 'node:fs/promises';
import path from 'node:path';
import { descriptionForProduct, factualProductDescription, sanitizeSupplierDescription } from './product-description.mjs';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'catalogue/dawood-products.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const slugify = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'design';
const productPath = item => clean(item.path) || `products/${slugify(item.code)}-${slugify(item.productName || item.name)}/`;
const unsafePattern = /<\/?[a-z][^>]*>|https?:\/\/|www\.|\b(?:whats?app|phone|mobile|contact|email|cash\s+on\s+delivery|cod|shipping|delivery|dispatch|courier|price|discount|dawood\s+designers?)\b|\b(?:rs\.?|pkr)\s*[\d,]+/i;
const promotionalPattern = /\b(?:premium(?:\s+quality)?|high[- ]?quality|stunning|beautiful|gorgeous|amazing|must[- ]?have|perfect\s+for|ideal\s+for|best[- ]?selling|exclusive\s+offer)\b/i;

function productSchema(page) {
  for (const match of page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(match[1].replace(/\\u003c/g, '<'));
      if (value?.['@type'] === 'Product') return value;
    } catch {}
  }
  return null;
}

async function validateGeneratedPage(item) {
  const description = descriptionForProduct(item);
  const relative = path.join(ROOT, productPath(item), 'index.html');
  const page = await fs.readFile(relative, 'utf8');
  assert(page.includes('class="product-description"'), `Product description section missing for ${item.code}.`);
  assert(page.includes(html(description.text)), `Visible description text mismatch for ${item.code}.`);
  const schema = productSchema(page);
  assert(schema, `Product schema missing for ${item.code}.`);
  assert(schema.description === description.text, `Product schema description mismatch for ${item.code}.`);
  return { code:item.code, source:description.source, heading:description.heading, generatedPage:true };
}

async function main() {
  const richHtml = `
    <p><strong>Shirt:</strong> Embroidered lawn front with embroidered sleeves</p>
    <p>Trouser: Dyed cotton trouser</p>
    <p>Dupatta: Chiffon dupatta with embroidered border</p>
    <p>Price: PKR 4,999</p>
    <p>Cash on Delivery available nationwide</p>
    <p>WhatsApp 0300-0000000 to order now</p>
    <p>Beautiful design perfect for your wardrobe</p>
    <script>alert('unsafe')</script>`;
  const sanitized = sanitizeSupplierDescription(richHtml, { productTitle:'Sample Embroidered Lawn 3PC' });
  assert(sanitized.includes('Shirt: Embroidered lawn front with embroidered sleeves'), 'Meaningful shirt detail was not retained.');
  assert(sanitized.includes('Trouser: Dyed cotton trouser'), 'Meaningful trouser detail was not retained.');
  assert(sanitized.includes('Dupatta: Chiffon dupatta with embroidered border'), 'Meaningful dupatta detail was not retained.');
  assert(!unsafePattern.test(sanitized), `Unsafe or commercial supplier text survived sanitization: ${sanitized}`);
  assert(!promotionalPattern.test(sanitized), `Promotional supplier text survived sanitization: ${sanitized}`);

  const weak = sanitizeSupplierDescription('<p>Sample Embroidered Lawn 3PC</p>', { productTitle:'Sample Embroidered Lawn 3PC' });
  assert(weak === '', 'Title-only supplier copy must be treated as insufficient.');

  const promotional = sanitizeSupplierDescription('<p>Stunning embroidered lawn shirt perfect for Eid</p><p>Beautiful must-have design for your wardrobe</p>', { productTitle:'Another Design' });
  assert(promotional === '', 'Generic supplier promotional prose must not be retained.');

  const malicious = sanitizeSupplierDescription('<p>Premium embroidered lawn shirt</p><img src=x onerror=alert(1)><p>Visit https://example.com</p>', { productTitle:'Another Design' });
  assert(malicious === '', 'Promotional, HTML or URL-only supplier copy must be rejected.');

  const supplierProduct = {
    code:'TEST-SUPPLIER-001', name:'Sample Embroidered Lawn 3PC', productName:'Sample Embroidered Lawn 3PC', brand:'Sample Brand',
    category:'Formal', pieceType:'3 Piece', pricingClass:'embroidered', available:true, sourceDescription:sanitized
  };
  const supplierDescription = descriptionForProduct(supplierProduct);
  assert(supplierDescription.source === 'supplier', 'Meaningful retained source description was not selected.');
  assert(supplierDescription.heading === 'Product description', 'Supplier description heading is incorrect.');

  const fallbackProduct = {
    code:'TEST-FALLBACK-001', name:'Printed Lawn 3PC', productName:'Printed Lawn 3PC', brand:'Sample Brand',
    category:'Formal', pieceType:'3 Piece', pricingClass:'non-embroidered', available:true
  };
  const fallback = descriptionForProduct(fallbackProduct);
  assert(fallback.source === 'catalogue', 'Missing supplier description did not use catalogue fallback.');
  assert(fallback.text === factualProductDescription(fallbackProduct), 'Fallback description is not deterministic.');
  assert(/3 Piece printed \/ non-embroidered unstitched design from Sample Brand/.test(fallback.text), 'Fallback omitted verified style/piece information.');
  assert(fallback.text.includes('Product code TEST-FALLBACK-001.'), 'Fallback omitted product code.');

  const unavailable = descriptionForProduct({ ...fallbackProduct, code:'TEST-UNAVAILABLE-001', available:false });
  assert(unavailable.text.includes('currently unavailable in the synchronized catalogue'), 'Unavailable fallback wording is incorrect.');

  const catalogue = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  const products = Array.isArray(catalogue.products) ? catalogue.products : [];
  assert(products.length >= 20, `Catalogue unexpectedly small: ${products.length}.`);

  const selectors = [
    ['embroidered', item => item.pricingClass === 'embroidered'],
    ['non-embroidered', item => item.pricingClass === 'non-embroidered'],
    ['price-on-enquiry', item => item.price == null],
    ['available', item => item.available === true],
    ['unavailable', item => item.available === false]
  ];
  const representatives = [];
  const seen = new Set();
  for (const [label, predicate] of selectors) {
    const item = products.find(predicate);
    assert(item, `No representative ${label} product exists in the current catalogue.`);
    const description = descriptionForProduct(item);
    assert(description.text.length >= 40, `${label} product description is too short: ${item.code}.`);
    assert(!/<\/?[a-z][^>]*>/i.test(description.text), `${label} product description contains HTML: ${item.code}.`);
    if (!seen.has(item.code)) {
      seen.add(item.code);
      representatives.push({ label, item, description });
    }
  }

  const sourceDescriptions = products.filter(item => clean(item.sourceDescription));
  for (const item of sourceDescriptions) {
    assert(!unsafePattern.test(item.sourceDescription), `Unsafe retained supplier description detected for ${item.code}.`);
    assert(!promotionalPattern.test(item.sourceDescription), `Promotional retained supplier description detected for ${item.code}.`);
  }

  const generated = [];
  for (const representative of representatives) {
    generated.push({ label:representative.label, ...(await validateGeneratedPage(representative.item)) });
  }

  const catalogueScript = await fs.readFile(path.join(ROOT, 'dawood-catalogue.js'), 'utf8');
  assert(catalogueScript.includes('live-dialog-description'), 'Main catalogue dialog is not wired to render product descriptions.');
  assert(catalogueScript.includes('escapeHtml(description.text)'), 'Main catalogue dialog does not HTML-escape description text.');

  const summary = {
    passed:true,
    catalogueProducts:products.length,
    retainedSupplierDescriptions:sourceDescriptions.length,
    fallbackDescriptions:products.length - sourceDescriptions.length,
    fixtureSupplierDescription:sanitized,
    representatives:generated
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
