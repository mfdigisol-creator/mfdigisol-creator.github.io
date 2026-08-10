const MAX_SOURCE_DESCRIPTION_LENGTH = 900;
const MIN_SOURCE_DESCRIPTION_WORDS = 6;

const BANNED_SEGMENT_PATTERNS = [
  /https?:\/\/|www\./i,
  /\b(?:whats?app|phone|mobile|contact|call(?:\s+us)?|email|e-mail|dm(?:\s+us)?|inbox)\b|@/i,
  /\b(?:cash\s+on\s+delivery|cod|shipping|delivery|dispatch|courier|free\s+shipping)\b/i,
  /\b(?:price|regular\s+price|sale\s+price|discount|save\s+\d+|\d+\s*%\s*off)\b/i,
  /\b(?:rs\.?|pkr)\s*[\d,]+/i,
  /\b(?:dawood\s+designers?|shop\s+now|buy\s+now|order\s+now|hurry|limited\s+time|follow\s+us|facebook|instagram|tiktok|youtube)\b/i,
  /\b(?:premium(?:\s+quality)?|high[- ]?quality|stunning|beautiful|gorgeous|amazing|must[- ]?have|perfect\s+for|ideal\s+for|best[- ]?selling|exclusive\s+offer)\b/i,
  /\b(?:return|exchange|refund)\s+(?:policy|available|within|period)/i
];

const PRODUCT_DETAIL_PATTERN = /\b(?:shirt|kameez|dupatta|trouser|shalwar|pants?|fabric|front|back|sleeves?|neck(?:line)?|daman|hem|border|panel|patti|patch|motif|lawn|organza|chiffon|silk|cotton|cambric|linen|karandi|khaddar|jacquard|net|velvet|viscose|wool|embroider(?:y|ed)|printed|digital\s+print|dyed|laser[ -]?cut|sequins?|schiffli|shiffli|chikan|cutwork|appliqu[eé]|[123]\s*(?:pc|pcs|piece))\b/i;

const decodeEntities = value => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&apos;|&#39;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '–')
  .replace(/&mdash;|&#8212;/gi, '—')
  .replace(/&bull;|&#8226;/gi, '•')
  .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
  .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number.parseInt(value, 10)));

const clean = value => decodeEntities(value)
  .replace(/[\u0000-\u001f\u007f]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const comparable = value => clean(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function htmlSegments(value) {
  let text = String(value ?? '');
  text = text
    .replace(/<\s*(script|style|noscript|iframe|svg)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(?:p|div|li|ul|ol|h[1-6]|tr|table|section|article)\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');
  text = decodeEntities(text).replace(/\r/g, '\n');
  return text
    .split(/\n+|\s*[|•●▪◦]\s*/)
    .map(segment => clean(segment).replace(/^[-–—:;,.\s]+|[-–—:;,\s]+$/g, '').trim())
    .filter(Boolean);
}

function truncate(value, maxLength = MAX_SOURCE_DESCRIPTION_LENGTH) {
  const text = clean(value);
  if (text.length <= maxLength) return text;
  const shortened = text.slice(0, maxLength - 1).replace(/\s+\S*$/, '').replace(/[;,:\s]+$/, '');
  return `${shortened}…`;
}

function materiallyDifferentFromTitle(text, productTitle) {
  const description = comparable(text);
  const title = comparable(productTitle);
  if (!description || description === title) return false;
  const words = description.split(/\s+/).filter(Boolean);
  if (words.length < MIN_SOURCE_DESCRIPTION_WORDS) return false;
  if (!title) return true;
  const titleWords = new Set(title.split(/\s+/).filter(Boolean));
  const additionalWords = words.filter(word => !titleWords.has(word));
  return new Set(additionalWords).size >= 3;
}

export function sanitizeSupplierDescription(value, { productTitle = '' } = {}) {
  const seen = new Set();
  const retained = [];
  for (const segment of htmlSegments(value)) {
    if (BANNED_SEGMENT_PATTERNS.some(pattern => pattern.test(segment))) continue;
    // Retain garment construction/material information, not generic supplier marketing prose.
    if (!PRODUCT_DETAIL_PATTERN.test(segment)) continue;
    const key = comparable(segment);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    retained.push(segment);
  }
  const description = truncate(retained.join('; '));
  return materiallyDifferentFromTitle(description, productTitle) ? description : '';
}

export function factualProductDescription(item) {
  const brand = clean(item?.brand) || 'the Al Huma Collection catalogue';
  const category = clean(item?.category);
  const pieceType = clean(item?.pieceType);
  const code = clean(item?.code);
  const style = item?.pricingClass === 'embroidered'
    ? 'embroidered '
    : item?.pricingClass === 'non-embroidered' ? 'printed / non-embroidered ' : '';
  const opening = pieceType && pieceType !== 'Unspecified'
    ? `${pieceType} ${style}unstitched design from ${brand}`
    : `${style ? `${style[0].toUpperCase()}${style.slice(1)}` : ''}unstitched design from ${brand}`;
  const collection = category ? `, listed in the ${category} collection` : '';
  const productCode = code ? ` Product code ${code}.` : '';
  const availability = item?.available
    ? ' Availability is subject to confirmation before dispatch.'
    : ' This design is currently unavailable in the synchronized catalogue.';
  return clean(`${opening}${collection}.${productCode}${availability}`);
}

export function descriptionForProduct(item) {
  const retained = clean(item?.sourceDescription);
  if (retained && materiallyDifferentFromTitle(retained, item?.productName || item?.name || '')) {
    return { text: retained, source: 'supplier', heading: 'Product description' };
  }
  return { text: factualProductDescription(item), source: 'catalogue', heading: 'Product information' };
}

export const descriptionPolicy = Object.freeze({
  maxSourceDescriptionLength: MAX_SOURCE_DESCRIPTION_LENGTH,
  minSourceDescriptionWords: MIN_SOURCE_DESCRIPTION_WORDS
});
