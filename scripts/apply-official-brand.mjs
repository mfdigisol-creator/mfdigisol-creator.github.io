import fs from 'node:fs/promises';

const file = 'index.html';
const logoPath = '/assets/alhuma-collection-logo.webp';
const logoUrl = 'https://alhumacollection.com/assets/alhuma-collection-logo.webp';
const organizationId = '"@id":"https://alhumacollection.com/#organization"';
const websiteId = '"@id":"https://alhumacollection.com/#website"';
const logoMarkup = `<img class="official-brand-logo" src="${logoPath}" alt="" aria-hidden="true" width="52" height="52" decoding="async" style="width:clamp(42px,4vw,52px);height:clamp(42px,4vw,52px);object-fit:contain;flex:0 0 auto;" />`;

let html = await fs.readFile(file, 'utf8');

const existingLogoMatches = html.match(/<img class="official-brand-logo"[^>]*>/g)?.length || 0;
const legacyMonogramMatches = html.match(/<span class="monogram" aria-hidden="true">AH<\/span>/g)?.length || 0;

html = html.replace(/<img class="official-brand-logo"[^>]*>/g, logoMarkup);
html = html.replace(/<span class="monogram" aria-hidden="true">AH<\/span>/g, logoMarkup);

if (existingLogoMatches + legacyMonogramMatches < 2) {
  throw new Error('Could not locate both primary Al Huma brand marks; refusing partial logo integration.');
}

const organizationStart = html.indexOf(organizationId);
const websiteStart = html.indexOf(websiteId, organizationStart);
if (organizationStart < 0 || websiteStart < 0) {
  throw new Error('Could not locate primary Al Huma Organization/WebSite graph; refusing logo schema update.');
}

let organization = html.slice(organizationStart, websiteStart);
if (/"logo":"[^"]*"/.test(organization)) {
  organization = organization.replace(/"logo":"[^"]*"/, `"logo":"${logoUrl}"`);
} else {
  const entityUrl = '"url":"https://alhumacollection.com/"';
  if (!organization.includes(entityUrl)) {
    throw new Error('Could not locate primary Al Huma Organization URL; refusing logo schema update.');
  }
  organization = organization.replace(entityUrl, `${entityUrl},"logo":"${logoUrl}"`);
}
html = `${html.slice(0, organizationStart)}${organization}${html.slice(websiteStart)}`;

await fs.writeFile(file, html);
console.log(`Official Al Huma logo applied to ${existingLogoMatches + legacyMonogramMatches} visible brand marks and Organization schema.`);
