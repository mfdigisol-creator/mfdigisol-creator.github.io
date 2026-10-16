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

const RELATION_UNSAFE_PATTERN = /\b(?:new\s+arrivals?|restock|hot\s+picks?|limited\s+stock|sale|special\s+price|hit\s+codes?|mix(?:ed)?\s+brands?|ready\s*(?:to|-)?\s*wear|pret)\b/i;
const RELATION_VOLUME_PATTERN = /\b(?:vol|volume)\s*(?:[-#]\s*)?\d+\b/i;
const RELATION_GENERIC_TOKENS = new Set([
  'and','by','collection','collections','daily','dd','deal','digital','digitally','dress','edit','eid','emb','embroidered','embroidery',
  'fabric','fall','formal','formals','fully','heavy','hit','kari','lawn','linen','luxury','new','of','overs','patch','patches','piece','pieces',
  'plain','premium','pret','print','printed','range','ready','restock','sale','series','shirt','solid','special','spring','stock','suit','suits',
  'summer','the','to','trending','unstitched','unstitch','vol','volume','wash','washing','wear','winter','with',
  'bana','cambric','chiffon','cotton','dhanak','dora','jacquard','karandi','khaddar','marina','net','organza','shamoz','silk','slub','velvet','viscose',
  'chikan','chikankari','chickenkari','schiffli','shiffli','lazer','laser','cutwork','applique','sequence','sequin','sequins','lifestyle','left','over','leftover','leftovers'
]);

function normalizeRelationWords(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizedBrandKey(value) {
  return normalizeRelationWords(value).join(' ');
}

function collectionIdentity(collection = {}) {
  const id = collection.id == null ? '' : String(collection.id).trim();
  const title = clean(collection.title);
  const handle = clean(collection.handle);
  return { id, title, handle };
}

function meaningfulCollectionTitleWords(collection, brand) {
  const brandWords = new Set(normalizeRelationWords(brand));
  return normalizeRelationWords(collection.title)
    .filter(word => !brandWords.has(word))
    .filter(word => !RELATION_GENERIC_TOKENS.has(word))
    .filter(word => !/^\d+$/.test(word))
    .filter(word => !/^[123](?:pc|pcs)$/.test(word))
    .filter(word => !/^20\d{2}$/.test(word));
}

function compareStableIds(a, b) {
  const aNum = /^\d+$/.test(a) ? BigInt(a) : null;
  const bNum = /^\d+$/.test(b) ? BigInt(b) : null;
  if (aNum !== null && bNum !== null) return aNum < bNum ? -1 : aNum > bNum ? 1 : 0;
  return a.localeCompare(b);
}

function isProperSubset(left, right) {
  if (left.size >= right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function sameMembers(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

export function deriveCanonicalRelations(products = [], { collectionAnomalies = [] } = {}) {
  const normalizedProducts = Array.isArray(products) ? products.filter(item => item && typeof item === 'object') : [];
  const anomaliesById = new Set(collectionAnomalies.map(item => String(item?.id ?? '').trim()).filter(Boolean));
  const anomaliesByHandle = new Set(collectionAnomalies.map(item => clean(item?.handle)).filter(Boolean));
  const collectionMap = new Map();

  for (const product of normalizedProducts) {
    const memberId = String(product.id ?? '').trim();
    if (!memberId) continue;
    for (const rawCollection of Array.isArray(product.sourceCollections) ? product.sourceCollections : []) {
      const collection = collectionIdentity(rawCollection);
      if (!collection.id) continue;
      if (!collectionMap.has(collection.id)) {
        collectionMap.set(collection.id, { ...collection, members: new Map() });
      }
      collectionMap.get(collection.id).members.set(memberId, product);
    }
  }

  const safeCollections = new Map();
  let genericCollectionsRejected = 0;
  let multiBrandCollectionsRejected = 0;
  let anomalyCollectionsRejected = 0;
  let undersizedCollectionsRejected = 0;

  for (const [id, entry] of collectionMap) {
    if (anomaliesById.has(id) || anomaliesByHandle.has(entry.handle)) {
      anomalyCollectionsRejected += 1;
      continue;
    }
    if (entry.members.size < 3) {
      undersizedCollectionsRejected += 1;
      continue;
    }
    const brands = [...new Set([...entry.members.values()].map(item => normalizedBrandKey(item.brand)).filter(Boolean))];
    if (brands.length !== 1) {
      multiBrandCollectionsRejected += 1;
      continue;
    }
    const brand = brands[0];
    const taxonomyText = `${entry.title} ${entry.handle}`;
    const titleWords = meaningfulCollectionTitleWords(entry, brand);
    if (!entry.title || !entry.handle || RELATION_UNSAFE_PATTERN.test(taxonomyText) || RELATION_VOLUME_PATTERN.test(entry.title) || titleWords.length === 0) {
      genericCollectionsRejected += 1;
      continue;
    }
    safeCollections.set(id, {
      id,
      title: entry.title,
      handle: entry.handle,
      brand,
      members: new Set(entry.members.keys())
    });
  }

  const assignments = new Map();
  let ambiguousRelationProducts = 0;
  for (const product of normalizedProducts) {
    const memberId = String(product.id ?? '').trim();
    if (!memberId) continue;
    const productBrand = normalizedBrandKey(product.brand);
    const candidates = (Array.isArray(product.sourceCollections) ? product.sourceCollections : [])
      .map(collection => safeCollections.get(String(collection?.id ?? '').trim()))
      .filter(candidate => candidate && candidate.brand === productBrand && candidate.members.has(memberId));
    if (!candidates.length) continue;

    const mostSpecific = candidates.filter(candidate => !candidates.some(other => other.id !== candidate.id && isProperSubset(other.members, candidate.members)));
    let selected = null;
    if (mostSpecific.length === 1) {
      selected = mostSpecific[0];
    } else if (mostSpecific.length > 1 && mostSpecific.every(candidate => sameMembers(candidate.members, mostSpecific[0].members))) {
      selected = [...mostSpecific].sort((a, b) => compareStableIds(a.id, b.id))[0];
    } else if (mostSpecific.length > 1) {
      ambiguousRelationProducts += 1;
    }
    if (selected) assignments.set(memberId, selected);
  }

  const mappedProducts = normalizedProducts.map(product => {
    const selected = assignments.get(String(product.id ?? '').trim());
    if (!selected) {
      return {
        ...product,
        relationKey: null,
        relationCollectionId: null,
        relationCollectionHandle: null,
        relationCollectionTitle: null
      };
    }
    return {
      ...product,
      relationKey: `dawood_collection:${selected.id}`,
      relationCollectionId: selected.id,
      relationCollectionHandle: selected.handle,
      relationCollectionTitle: selected.title
    };
  });

  const finalGroups = new Map();
  for (const product of mappedProducts) {
    if (!product.relationKey) continue;
    if (!finalGroups.has(product.relationKey)) finalGroups.set(product.relationKey, []);
    finalGroups.get(product.relationKey).push(product);
  }
  const groups = [...finalGroups.entries()]
    .filter(([, members]) => members.length >= 3)
    .map(([relationKey, members]) => ({
      relationKey,
      collectionId: members[0].relationCollectionId,
      collectionTitle: members[0].relationCollectionTitle,
      collectionHandle: members[0].relationCollectionHandle,
      brand: members[0].brand,
      products: members.length,
      available: members.filter(item => item.available === true).length,
      productCodes: members.map(item => item.code).filter(Boolean).sort()
    }))
    .sort((a, b) => compareStableIds(a.collectionId, b.collectionId));

  const mappedCount = mappedProducts.filter(item => item.relationKey).length;
  return {
    products: mappedProducts,
    diagnostics: {
      relationMappedProducts: mappedCount,
      relationUnmappedProducts: mappedProducts.length - mappedCount,
      relationGroups: finalGroups.size,
      relationGroupsWith3PlusProducts: groups.length,
      ambiguousRelationProducts,
      genericCollectionsRejected,
      multiBrandCollectionsRejected,
      anomalyCollectionsRejected,
      undersizedCollectionsRejected,
      safeCandidateCollections: safeCollections.size,
      groups
    }
  };
}
