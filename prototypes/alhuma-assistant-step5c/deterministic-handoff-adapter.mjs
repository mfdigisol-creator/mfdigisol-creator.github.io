const INTERPRETATION_FIELDS = new Set([
  'intent',
  'productCode',
  'productName',
  'brand',
  'category',
  'pieceType',
  'pricingClass',
  'budgetMax',
  'asksPrice',
  'asksAvailability',
  'asksCount',
  'language',
  'needsClarification',
  'contextUsed',
  'outOfDomain',
  'blockedReason',
]);

const COMPATIBILITY_IGNORED_FIELDS = new Set(['nextContext']);

const CONTEXT_FIELDS = [
  'productCode',
  'productName',
  'brand',
  'category',
  'pieceType',
  'pricingClass',
  'budgetMax',
];

const ALLOWED_INTENTS = new Set([
  'product_lookup',
  'catalogue_search',
  'availability',
  'count',
  'price_range',
  'price_request',
  'cod',
  'delivery',
  'cancellation',
  'confidential_request',
  'out_of_domain',
  'unknown',
]);

const ENUMS = {
  category: new Set(['Formal', 'Luxury']),
  pieceType: new Set(['2 Piece', '3 Piece']),
  pricingClass: new Set(['embroidered', 'non-embroidered']),
  language: new Set(['english', 'roman-urdu']),
};

const FACTUAL_FIELD_NAMES = new Set([
  'price',
  'priceRange',
  'availability',
  'available',
  'availableCount',
  'productCount',
  'deliveryCharge',
  'deliveryFee',
  'codRule',
  'policyText',
  'wholesalePrice',
  'markup',
  'margin',
]);

function emptyContext() {
  return {
    productCode: null,
    productName: null,
    brand: null,
    category: null,
    pieceType: null,
    pricingClass: null,
    budgetMax: null,
  };
}

function isNullableString(value) {
  return value === null || typeof value === 'string';
}

function isNullableBoolean(value) {
  return value === null || typeof value === 'boolean';
}

function validateInterpretation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok:false, reason:'not_object', rejectedFields:[] };
  }

  const rejectedFields = Object.keys(input).filter(
    key => !INTERPRETATION_FIELDS.has(key) && !COMPATIBILITY_IGNORED_FIELDS.has(key)
  );

  if (rejectedFields.length) {
    return {
      ok:false,
      reason:rejectedFields.some(key => FACTUAL_FIELD_NAMES.has(key)) ? 'interpreter_factual_field_rejected' : 'unknown_field_rejected',
      rejectedFields,
    };
  }

  if (!ALLOWED_INTENTS.has(input.intent)) {
    return { ok:false, reason:'invalid_intent', rejectedFields:[] };
  }

  for (const key of ['productCode','productName','brand','blockedReason']) {
    if (!isNullableString(input[key] ?? null)) return { ok:false, reason:'invalid_' + key, rejectedFields:[] };
  }

  for (const key of ['asksPrice','asksAvailability','asksCount','needsClarification','contextUsed','outOfDomain']) {
    if (!isNullableBoolean(input[key] ?? null)) return { ok:false, reason:'invalid_' + key, rejectedFields:[] };
  }

  for (const [key, allowed] of Object.entries(ENUMS)) {
    const value = input[key] ?? null;
    if (value !== null && !allowed.has(value)) return { ok:false, reason:'invalid_' + key, rejectedFields:[] };
  }

  const budget = input.budgetMax ?? null;
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
    return { ok:false, reason:'invalid_budgetMax', rejectedFields:[] };
  }

  return {
    ok:true,
    value:{
      intent:input.intent,
      productCode:input.productCode ?? null,
      productName:input.productName ?? null,
      brand:input.brand ?? null,
      category:input.category ?? null,
      pieceType:input.pieceType ?? null,
      pricingClass:input.pricingClass ?? null,
      budgetMax:budget,
      asksPrice:Boolean(input.asksPrice),
      asksAvailability:Boolean(input.asksAvailability),
      asksCount:Boolean(input.asksCount),
      language:input.language ?? 'english',
      needsClarification:Boolean(input.needsClarification),
      contextUsed:Boolean(input.contextUsed),
      outOfDomain:Boolean(input.outOfDomain),
      blockedReason:input.blockedReason ?? null,
    },
    ignoredFields:Object.keys(input).filter(key => COMPATIBILITY_IGNORED_FIELDS.has(key)),
    rejectedFields:[],
  };
}

function sanitizeContext(input = {}) {
  const clean = emptyContext();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return clean;

  for (const key of CONTEXT_FIELDS) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (key === 'budgetMax') {
      if (Number.isFinite(value) && value >= 0) clean[key] = value;
    } else if (key in ENUMS) {
      if (ENUMS[key].has(value)) clean[key] = value;
    } else if (typeof value === 'string') {
      clean[key] = value;
    }
  }
  return clean;
}

function hasExplicitProduct(input) {
  return Boolean(input.productCode || input.productName);
}

function resolveContext(input, priorContext) {
  const prior = sanitizeContext(priorContext);
  const explicitProduct = hasExplicitProduct(input);
  const base = input.contextUsed ? { ...prior } : emptyContext();
  let contextResolution = input.contextUsed ? 'inherited' : 'fresh';

  if (explicitProduct) {
    base.productCode = null;
    base.productName = null;
    if (input.contextUsed && (prior.productCode || prior.productName)) {
      contextResolution = 'current_product_overrode_prior';
    }
  }

  for (const key of CONTEXT_FIELDS) {
    const value = input[key];
    if (value !== null && value !== undefined) base[key] = value;
  }

  return { context:base, contextResolution };
}

function resolveProductIdentity(context, catalogue) {
  const byCode = context.productCode
    ? catalogue.find(item => String(item.code).toLowerCase() === String(context.productCode).toLowerCase())
    : null;
  const byName = context.productName
    ? catalogue.find(item => String(item.name).toLowerCase() === String(context.productName).toLowerCase())
    : null;

  if (context.productCode && context.productName && byCode && byName && byCode.code !== byName.code) {
    return { conflict:true, product:null };
  }

  const product = byCode || byName || null;
  return { conflict:false, product };
}

function filterCatalogue(catalogue, context) {
  return catalogue.filter(item => {
    if (context.productCode && String(item.code).toLowerCase() !== String(context.productCode).toLowerCase()) return false;
    if (context.productName && String(item.name).toLowerCase() !== String(context.productName).toLowerCase()) return false;
    if (context.brand && item.brand !== context.brand) return false;
    if (context.category && item.category !== context.category) return false;
    if (context.pieceType && item.pieceType !== context.pieceType) return false;
    if (context.pricingClass && item.pricingClass !== context.pricingClass) return false;
    if (context.budgetMax !== null) {
      if (!Number.isFinite(item.price) || item.price > context.budgetMax) return false;
    }
    return true;
  });
}

function activeFilters(context) {
  return Object.fromEntries(
    CONTEXT_FIELDS
      .filter(key => context[key] !== null && context[key] !== undefined)
      .map(key => [key, context[key]])
  );
}

function routeFor(input, hasProduct) {
  if (input.intent === 'cod') return 'static_cod';
  if (input.intent === 'delivery') return 'static_delivery';
  if (input.intent === 'cancellation') return 'static_cancellation';

  if (hasProduct) {
    if (input.asksAvailability || input.intent === 'availability') return 'product_availability';
    if (input.asksPrice || input.intent === 'price_request' || input.intent === 'price_range') return 'product_price';
    return 'product_lookup';
  }

  if (input.asksCount || input.intent === 'count') return 'catalogue_count';
  if (input.asksAvailability || input.intent === 'availability') return 'catalogue_availability';
  if (input.intent === 'price_range') return 'catalogue_price_range';
  if (input.asksPrice || input.intent === 'price_request') return 'catalogue_price';
  return 'catalogue_search';
}

function isCatalogueDependent(input) {
  return !['cod','delivery','cancellation','confidential_request','out_of_domain'].includes(input.intent);
}

export function createHandoffAdapter({ catalogue = [] } = {}) {
  const safeCatalogue = Array.isArray(catalogue) ? catalogue.map(item => ({
    code:String(item.code ?? ''),
    name:String(item.name ?? ''),
    brand:item.brand ?? null,
    category:item.category ?? null,
    pieceType:item.pieceType ?? null,
    pricingClass:item.pricingClass ?? null,
    price:Number.isFinite(item.price) ? item.price : null,
    available:Boolean(item.available),
  })) : [];

  return {
    resolve(interpretation, { priorContext = {}, catalogueAvailable = true } = {}) {
      const validation = validateInterpretation(interpretation);
      if (!validation.ok) {
        return {
          route:'invalid_interpretation',
          reason:validation.reason,
          rejectedFields:validation.rejectedFields,
          filters:{},
          matchedCodes:[],
          nextContext:emptyContext(),
          contextResolution:'rejected',
        };
      }

      const input = validation.value;

      if (input.intent === 'confidential_request' || input.blockedReason === 'prohibited_internal_data') {
        return {
          route:'blocked_confidential',
          reason:'prohibited_internal_data',
          rejectedFields:[],
          ignoredFields:validation.ignoredFields,
          filters:{},
          matchedCodes:[],
          nextContext:emptyContext(),
          contextResolution:'cleared',
        };
      }

      if (input.intent === 'out_of_domain' || input.outOfDomain) {
        return {
          route:'out_of_domain',
          reason:'shopping_domain_only',
          rejectedFields:[],
          ignoredFields:validation.ignoredFields,
          filters:{},
          matchedCodes:[],
          nextContext:emptyContext(),
          contextResolution:'cleared',
        };
      }

      if (input.needsClarification) {
        return {
          route:'clarification',
          reason:'ambiguous_reference',
          rejectedFields:[],
          ignoredFields:validation.ignoredFields,
          filters:{},
          matchedCodes:[],
          nextContext:emptyContext(),
          contextResolution:'cleared',
        };
      }

      const { context, contextResolution } = resolveContext(input, priorContext);
      const identity = resolveProductIdentity(context, safeCatalogue);

      if (identity.conflict) {
        return {
          route:'clarification',
          reason:'conflicting_product_identity',
          rejectedFields:[],
          ignoredFields:validation.ignoredFields,
          filters:activeFilters(context),
          matchedCodes:[],
          nextContext:emptyContext(),
          contextResolution:'conflict_rejected',
        };
      }

      if (identity.product) {
        context.productCode = identity.product.code;
        context.productName = identity.product.name;
      } else if (context.productCode || context.productName) {
        return {
          route:'no_match',
          reason:'product_not_found',
          rejectedFields:[],
          ignoredFields:validation.ignoredFields,
          filters:activeFilters(context),
          matchedCodes:[],
          nextContext:emptyContext(),
          contextResolution,
        };
      }

      if (!catalogueAvailable && isCatalogueDependent(input)) {
        return {
          route:'catalogue_unavailable',
          reason:'deterministic_catalogue_required',
          rejectedFields:[],
          ignoredFields:validation.ignoredFields,
          filters:activeFilters(context),
          matchedCodes:[],
          nextContext:sanitizeContext(context),
          contextResolution,
        };
      }

      const staticRoute = routeFor(input, Boolean(identity.product));
      if (staticRoute.startsWith('static_')) {
        return {
          route:staticRoute,
          reason:null,
          rejectedFields:[],
          ignoredFields:validation.ignoredFields,
          filters:{},
          matchedCodes:[],
          nextContext:emptyContext(),
          contextResolution:'fresh',
        };
      }

      const matches = filterCatalogue(safeCatalogue, context);
      if (!matches.length) {
        return {
          route:'no_match',
          reason:'zero_matching_products',
          rejectedFields:[],
          ignoredFields:validation.ignoredFields,
          filters:activeFilters(context),
          matchedCodes:[],
          nextContext:sanitizeContext(context),
          contextResolution,
        };
      }

      if (staticRoute === 'product_price' && matches.length === 1 && !Number.isFinite(matches[0].price)) {
        return {
          route:'price_on_enquiry',
          reason:'missing_displayed_price',
          rejectedFields:[],
          ignoredFields:validation.ignoredFields,
          filters:activeFilters(context),
          matchedCodes:[matches[0].code],
          nextContext:sanitizeContext(context),
          contextResolution,
        };
      }

      return {
        route:staticRoute,
        reason:null,
        rejectedFields:[],
        ignoredFields:validation.ignoredFields,
        filters:activeFilters(context),
        matchedCodes:matches.map(item => item.code),
        nextContext:sanitizeContext(context),
        contextResolution,
      };
    },
  };
}

export const handoffContract = Object.freeze({
  interpretationFields:[...INTERPRETATION_FIELDS],
  ignoredCompatibilityFields:[...COMPATIBILITY_IGNORED_FIELDS],
  contextFields:[...CONTEXT_FIELDS],
  allowedIntents:[...ALLOWED_INTENTS],
});
