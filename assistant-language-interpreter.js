const EMPTY_CONTEXT = Object.freeze({
  productCode: null,
  productName: null,
  brand: null,
  category: null,
  pieceType: null,
  pricingClass: null,
  budgetMax: null,
});

const TYPO_MAP = new Map([
  ['delivry', 'delivery'],
  ['delvery', 'delivery'],
  ['deliveri', 'delivery'],
  ['availble', 'available'],
  ['avialable', 'available'],
  ['luxry', 'luxury'],
  ['embrodiered', 'embroidered'],
  ['embroided', 'embroidered'],
  ['cancelation', 'cancellation'],
]);

const ROMAN_URDU_MARKERS = new Set([
  'kya','hai','hain','chahiye','chahye','dikhao','dikhayo','tak','hazar','hazaar','krna','karna','wala','wali','walay',
  'kitne','kitna','mein','se','kam','ka','ke','ki','ye','yeh','woh','naam','batao','milta','milti'
]);

const CONFIDENTIAL_PATTERNS = [
  /\bsupplier\b/i,
  /\bvendor\b/i,
  /\bwholesale\b/i,
  /\bsource\s+price\b/i,
  /\bmarkup\b/i,
  /\bmargin\b/i,
  /\binternal\s+pricing\b/i,
];

const DOMAIN_TERMS = [
  'product','design','suit','collection','catalog','catalogue','brand','formal','luxury','piece','pc','embroidered','embroidery','printed',
  'price','prices','cost','rate','range','budget','available','availability','stock','delivery','courier','shipping','cod','cash on delivery',
  'cancel','cancellation','order','buy','purchase','checkout','review','rating','return','exchange','refund','fabric','quality','contact','whatsapp'
];

function normalizeToken(token) {
  return TYPO_MAP.get(token) || token;
}

export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeToken)
    .join(' ');
}

function detectLanguage(normalized) {
  const tokens = normalized.split(' ').filter(Boolean);
  return tokens.some(token => ROMAN_URDU_MARKERS.has(token)) ? 'roman-urdu' : 'english';
}

function containsPhrase(normalized, phrase) {
  return (' ' + normalized + ' ').includes(' ' + normalizeText(phrase) + ' ');
}

function safeContext(input = {}) {
  const out = { ...EMPTY_CONTEXT };
  for (const key of Object.keys(out)) {
    if (input[key] !== undefined && input[key] !== null) out[key] = input[key];
  }
  return out;
}

function findVocabularyEntity(raw, normalized, list = [], key = 'value') {
  const candidates = Array.isArray(list) ? list : [];
  for (const entry of candidates) {
    const value = typeof entry === 'string' ? entry : entry?.[key];
    if (!value) continue;
    if (key === 'code') {
      if (String(raw).toUpperCase().includes(String(value).toUpperCase())) return entry;
    } else if (containsPhrase(normalized, value)) {
      return entry;
    }
  }
  return null;
}

function parseBudget(normalized) {
  let match = normalized.match(/\b(\d+(?:\.\d+)?)\s*k\b/);
  if (match) return Math.round(Number(match[1]) * 1000);

  match = normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:hazar|hazaar)\b/);
  if (match) return Math.round(Number(match[1]) * 1000);

  const hasBudgetQualifier = /\b(?:budget|under|below|upto|up to|less than|tak|se kam|within)\b/.test(normalized);
  if (!hasBudgetQualifier) return null;

  match = normalized.match(/\b(\d{3,6})\b/);
  return match ? Number(match[1]) : null;
}

function parsePieceType(normalized) {
  const match = normalized.match(/\b([23])\s*(?:piece|pc)\b/);
  return match ? match[1] + ' Piece' : null;
}

function parsePricingClass(normalized) {
  if (/\b(?:non\s*embroidered|nonembroidered|printed)\b/.test(normalized)) return 'non-embroidered';
  if (/\b(?:embroidered|embroidery|embroider|emb)\b/.test(normalized)) return 'embroidered';
  return null;
}

function isConfidentialRequest(raw, normalized) {
  return CONFIDENTIAL_PATTERNS.some(pattern => pattern.test(raw) || pattern.test(normalized));
}

function hasFollowupReference(normalized) {
  return /\b(?:and|also|what about|ye|yeh|woh|this|that|it|is code|is wala|woh wala)\b/.test(normalized);
}

function wantsPrice(normalized) {
  return /\b(?:price|prices|cost|rate|how much|range|kitne ka|kitna ka)\b/.test(normalized);
}

function wantsAvailability(normalized) {
  return /\b(?:available|availability|stock|stock mein)\b/.test(normalized);
}

function wantsCount(normalized) {
  if (/\b(?:kitne ka|kitna ka)\b/.test(normalized)) return false;
  return /\b(?:how many|count|kitne|number of products|total products)\b/.test(normalized);
}

function hasDomainCue(normalized, entities) {
  if (Object.values(entities).some(Boolean)) return true;
  return DOMAIN_TERMS.some(term => normalized.includes(term));
}

function inheritContext(entities, priorContext, allowInheritance) {
  const previous = safeContext(priorContext);
  if (!allowInheritance) return { entities, contextUsed: false };

  const next = { ...entities };
  let contextUsed = false;
  for (const key of Object.keys(EMPTY_CONTEXT)) {
    if ((next[key] === null || next[key] === undefined) && previous[key] !== null && previous[key] !== undefined) {
      next[key] = previous[key];
      contextUsed = true;
    }
  }
  return { entities: next, contextUsed };
}

function deriveIntent({ normalized, entities, asksPrice, asksAvailability, asksCount, needsClarification }) {
  if (needsClarification && /\b(?:ye|yeh|woh|this|that|it|is code|wala|wali)\b/.test(normalized)) return 'product_lookup';
  if (/\b(?:cash on delivery|cod)\b/.test(normalized)) return 'cod';
  if (/\b(?:delivery|courier|shipping)\b/.test(normalized)) return 'delivery';
  if (/\b(?:cancel|cancellation)\b/.test(normalized)) return 'cancellation';
  if (asksCount) return 'count';
  if (asksPrice && /\brange\b/.test(normalized)) return 'price_range';
  if (asksAvailability) return 'availability';
  if (entities.productCode || entities.productName) return 'product_lookup';
  if (entities.brand || entities.category || entities.pieceType || entities.pricingClass || entities.budgetMax !== null) return 'catalogue_search';
  if (asksPrice) return 'price_request';
  return 'unknown';
}

export function createInterpreter({ vocabulary = {} } = {}) {
  const productEntries = (vocabulary.products || []).map(item => ({
    code: item.code || null,
    name: item.name || null,
  }));
  const brandEntries = (vocabulary.brands || []).map(name => ({ name }));

  return {
    interpret(message, prior = {}) {
      const raw = String(message ?? '');
      const normalized = normalizeText(raw);
      const language = detectLanguage(normalized);

      if (isConfidentialRequest(raw, normalized)) {
        return {
          intent: 'confidential_request',
          productCode: null,
          productName: null,
          brand: null,
          category: null,
          pieceType: null,
          pricingClass: null,
          budgetMax: null,
          asksPrice: wantsPrice(normalized),
          asksAvailability: false,
          asksCount: false,
          language,
          needsClarification: false,
          contextUsed: false,
          outOfDomain: false,
          blockedReason: 'prohibited_internal_data',
          nextContext: { ...EMPTY_CONTEXT },
        };
      }

      const matchedProduct = findVocabularyEntity(raw, normalized, productEntries, 'code') ||
        findVocabularyEntity(raw, normalized, productEntries, 'name');
      const matchedBrand = findVocabularyEntity(raw, normalized, brandEntries, 'name');

      let entities = {
        productCode: matchedProduct?.code || null,
        productName: matchedProduct?.name || null,
        brand: matchedBrand?.name || null,
        category: containsPhrase(normalized, 'luxury') ? 'Luxury' : (containsPhrase(normalized, 'formal') ? 'Formal' : null),
        pieceType: parsePieceType(normalized),
        pricingClass: parsePricingClass(normalized),
        budgetMax: parseBudget(normalized),
      };

      const asksPrice = wantsPrice(normalized);
      const asksAvailability = wantsAvailability(normalized);
      const asksCount = wantsCount(normalized);
      const followup = hasFollowupReference(normalized);
      const contextualFactualAsk = followup && (asksPrice || asksAvailability || asksCount || entities.budgetMax !== null);
      const inherited = inheritContext(entities, prior, contextualFactualAsk);
      entities = inherited.entities;

      const explicitReference = matchedProduct || matchedBrand || entities.category || entities.pieceType || entities.pricingClass || entities.budgetMax !== null;
      const deicticReference = /\b(?:ye|yeh|woh|this|that|it|is code|is wala|woh wala|wala|wali)\b/.test(normalized);
      const needsClarification = Boolean(deicticReference && !explicitReference && !entities.productCode && !entities.productName && !entities.brand && !entities.category && !entities.pieceType && !entities.pricingClass);

      const outOfDomain = !hasDomainCue(normalized, entities) && !asksPrice && !asksAvailability && !asksCount;
      if (outOfDomain) {
        return {
          intent: 'out_of_domain',
          ...EMPTY_CONTEXT,
          asksPrice: false,
          asksAvailability: false,
          asksCount: false,
          language,
          needsClarification: false,
          contextUsed: false,
          outOfDomain: true,
          blockedReason: null,
          nextContext: { ...EMPTY_CONTEXT },
        };
      }

      const intent = deriveIntent({ normalized, entities, asksPrice, asksAvailability, asksCount, needsClarification });
      const nextContext = safeContext(entities);

      return {
        intent,
        ...entities,
        asksPrice,
        asksAvailability,
        asksCount,
        language,
        needsClarification,
        contextUsed: inherited.contextUsed,
        outOfDomain: false,
        blockedReason: null,
        nextContext,
      };
    },
  };
}
