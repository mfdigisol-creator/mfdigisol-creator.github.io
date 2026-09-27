const clean = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const lower = value => clean(value).toLowerCase();

const MEN_PATTERN = /\b(?:men|mens|men['’]?s|menswear|male|boys?)\b/i;
const READY_TO_WEAR_PATTERN = /\bready\s*(?:to|-)?\s*wear\b|\bpret\b|\bstitched\b/i;
const UNSTITCHED_PATTERN = /\bunstitch(?:ed)?\b/i;
const FABRIC_SUIT_PATTERN = /\b(?:lawn|khaddar|linen|viscose|karandi|marina|dhanak|organza|chiffon|silk|cambric|jacquard|cotton|net|velvet|shirt|trouser|dupatta|shawl|suit)\b/i;
const LUXURY_PATTERN = /\bluxury\b/i;
const EMBROIDERY_PATTERN = /\bemb(?:\.|roidery|roidered)?\b|chikan|chicken|schiffli|shiffli|laser[ -]?cut|cutwork|boring|patch|appliqu[eé]|sequence|sequins?/i;
const NON_EMBROIDERY_PATTERN = /\bdigital(?:ly)?\s+print|\bprinted\b|\bprint\b|\bplain\b|\bsolid\b|\bblock\s*print|\bwash\s*&?\s*wear\b/i;
const PIECE_PATTERN = /\b([123])\s*(?:-|\s)?(?:pc|pcs|piece)\b/i;
const SIZE_NAME_PATTERN = /^(?:size|sizes)$/i;
const SIZE_VALUE_PATTERN = /^(?:xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|5xl|6xl|small|medium|large|extra\s*large)$/i;

const SEASONS = [
  ['Winter', /\bwinter\b/i],
  ['Summer', /\bsummer\b/i],
  ['Eid', /\beid\b/i],
  ['Spring', /\bspring\b/i],
  ['Autumn', /\b(?:autumn|fall)\b/i],
  ['Ramadan', /\bramadan\b/i]
];

export function normalizeCollection(collection = {}) {
  return {
    id: collection.id == null ? null : String(collection.id),
    title: clean(collection.title),
    handle: clean(collection.handle),
    productsCount: Number(collection.products_count ?? collection.productsCount ?? 0) || 0,
    publishedAt: collection.published_at || collection.publishedAt || null,
    updatedAt: collection.updated_at || collection.updatedAt || null
  };
}

function tags(product) {
  return Array.isArray(product?.tags) ? product.tags.map(clean).filter(Boolean) : [];
}

function optionSummary(product) {
  const options = Array.isArray(product?.options) ? product.options : [];
  return options.map(option => ({
    name: clean(option?.name),
    values: Array.isArray(option?.values) ? option.values.map(clean).filter(Boolean) : []
  }));
}

export function hasGarmentSizes(product) {
  return optionSummary(product).some(option => {
    if (SIZE_NAME_PATTERN.test(option.name)) return true;
    const values = option.values.filter(Boolean);
    return values.length >= 2 && values.every(value => SIZE_VALUE_PATTERN.test(value));
  });
}

function structuredScopeText(product, collections) {
  return [
    product?.title,
    product?.product_type,
    ...tags(product),
    ...collections.flatMap(collection => [collection.title, collection.handle])
  ].map(clean).filter(Boolean).join(' ');
}

function weakProductText(product) {
  return clean(product?.body_html);
}

export function classifyPieceType(product, collections = []) {
  const type = clean(product?.product_type);
  const direct = type.match(PIECE_PATTERN);
  if (direct) return `${direct[1]} Piece`;
  const match = structuredScopeText(product, collections).match(PIECE_PATTERN)
    || weakProductText(product).match(PIECE_PATTERN);
  return match ? `${match[1]} Piece` : 'Unspecified';
}

export function classifyEmbroidery(product, collections = []) {
  const strong = [
    ...tags(product),
    ...collections.flatMap(collection => [collection.title, collection.handle]),
    product?.title
  ].map(clean).join(' ');
  if (EMBROIDERY_PATTERN.test(strong)) return 'embroidered';
  if (NON_EMBROIDERY_PATTERN.test(strong)) return 'non-embroidered';
  const weak = weakProductText(product);
  if (EMBROIDERY_PATTERN.test(weak)) return 'embroidered';
  if (NON_EMBROIDERY_PATTERN.test(weak)) return 'non-embroidered';
  return 'unknown';
}

export function classifyBusinessGroup(product, collections = []) {
  const strong = [
    product?.title,
    ...tags(product),
    ...collections.flatMap(collection => [collection.title, collection.handle])
  ].map(clean).join(' ');
  return LUXURY_PATTERN.test(strong) ? 'Luxury' : 'Formal';
}

export function extractSeasons(product, collections = []) {
  const collectionText = collections.flatMap(collection => [collection.title, collection.handle]).map(clean).join(' ');
  const tagText = tags(product).join(' ');
  const titleText = clean(product?.title);
  const seasons = [];
  for (const [name, pattern] of SEASONS) {
    if (pattern.test(collectionText) || pattern.test(tagText) || pattern.test(titleText)) seasons.push(name);
  }
  return [...new Set(seasons)];
}

export function choosePrimaryCollection(collections = []) {
  if (!collections.length) return null;
  const scored = collections.map(collection => {
    const text = `${collection.title} ${collection.handle}`;
    let score = 0;
    if (UNSTITCHED_PATTERN.test(text)) score += 8;
    if (LUXURY_PATTERN.test(text)) score += 5;
    if (SEASONS.some(([, pattern]) => pattern.test(text))) score += 4;
    if (PIECE_PATTERN.test(text)) score += 2;
    return { collection, score };
  });
  scored.sort((a, b) => b.score - a.score || a.collection.title.localeCompare(b.collection.title));
  return scored[0].collection;
}

export function classifyScope(product, rawCollections = []) {
  const collections = rawCollections.map(normalizeCollection);
  const tagValues = tags(product);
  const structured = structuredScopeText(product, collections);
  const title = clean(product?.title);
  const productType = clean(product?.product_type);
  const reasons = [];

  const menStructured = [
    title,
    productType,
    ...tagValues,
    ...collections.flatMap(collection => [collection.title, collection.handle])
  ].join(' ');
  if (MEN_PATTERN.test(menStructured)) {
    return { status: 'excluded', reasons: ['menswear-signal'] };
  }

  const sizeVariants = hasGarmentSizes(product);
  const rtwStructured = [
    title,
    ...tagValues,
    ...collections.flatMap(collection => [collection.title, collection.handle])
  ].join(' ');
  if (sizeVariants) reasons.push('garment-size-variants');
  if (READY_TO_WEAR_PATTERN.test(rtwStructured)) reasons.push('ready-to-wear-or-stitched-signal');
  if (sizeVariants || READY_TO_WEAR_PATTERN.test(rtwStructured)) {
    return { status: 'excluded', reasons };
  }

  const pieceType = classifyPieceType(product, collections);
  const explicitUnstitched = UNSTITCHED_PATTERN.test(structured);
  const suitPieceCount = pieceType === '2 Piece' || pieceType === '3 Piece';
  const fabricSuitEvidence = FABRIC_SUIT_PATTERN.test(structured) || FABRIC_SUIT_PATTERN.test(weakProductText(product));

  if (pieceType === '1 Piece') {
    return { status: 'excluded', reasons: ['single-piece-not-approved-suit-scope'] };
  }

  if (explicitUnstitched) reasons.push('unstitched-structured-signal');
  if (suitPieceCount) reasons.push('two-or-three-piece-product');
  if (fabricSuitEvidence) reasons.push('fabric-suit-signal');

  if (explicitUnstitched && (suitPieceCount || fabricSuitEvidence)) {
    return { status: 'included', reasons };
  }
  if (suitPieceCount && fabricSuitEvidence) {
    return { status: 'included', reasons };
  }

  return {
    status: 'ambiguous',
    reasons: reasons.length ? reasons : ['insufficient-ladies-unstitched-evidence']
  };
}

export function classifyProduct(product, rawCollections = []) {
  const collections = rawCollections.map(normalizeCollection);
  const scope = classifyScope(product, collections);
  return {
    ...scope,
    collections,
    primaryCollection: choosePrimaryCollection(collections),
    category: classifyBusinessGroup(product, collections),
    pieceType: classifyPieceType(product, collections),
    pricingClass: classifyEmbroidery(product, collections),
    seasons: extractSeasons(product, collections)
  };
}

export function summarizeScope(classified = []) {
  const counts = { included: 0, excluded: 0, ambiguous: 0 };
  const exclusionReasons = {};
  for (const item of classified) {
    counts[item.classification.status] += 1;
    if (item.classification.status === 'excluded') {
      for (const reason of item.classification.reasons) exclusionReasons[reason] = (exclusionReasons[reason] || 0) + 1;
    }
  }
  return { ...counts, exclusionReasons };
}
