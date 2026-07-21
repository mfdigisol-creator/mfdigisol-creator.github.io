import fs from 'node:fs/promises';

const file = 'index.html';
let html = await fs.readFile(file, 'utf8');

const catalogueSection = `      <section class="live-catalogue section-pad" id="live-catalogue" aria-labelledby="live-catalogue-title" data-live-catalogue hidden>
        <div class="live-catalogue-head reveal">
          <div><p class="eyebrow"><span></span> Synchronized catalogue</p><h2 id="live-catalogue-title">Latest<br /><em>designs.</em></h2></div>
          <div class="live-catalogue-summary"><p>Explore current unstitched formal and luxury collections. Catalogue information is refreshed approximately every 12 hours.</p><div class="live-sync-meta"><span data-live-sync-time>Preparing catalogue</span><span>Official WhatsApp ordering</span></div></div>
        </div>
        <div class="live-collection-showcase reveal" data-live-collection-showcase aria-label="Browse collections">
          <div class="live-collection-showcase-head"><div><span>Curated for you</span><h3>Shop by collection</h3></div><div class="live-collection-arrows"><button type="button" data-collection-prev aria-label="Previous collections">←</button><button type="button" data-collection-next aria-label="Next collections">→</button></div></div>
          <div class="live-collection-slider" data-live-collection-slider tabindex="0"><p>Loading collections…</p></div>
        </div>
        <div class="live-tools" aria-label="Search and filter synchronized catalogue">
          <label class="live-search"><span>Search designs</span><input type="search" placeholder="Product, brand or code" autocomplete="off" data-live-search /></label>
          <label><span>Category</span><select data-live-category><option value="all">All categories</option><option value="Formal">Formal</option><option value="Luxury">Luxury</option></select></label>
          <label><span>Collection</span><select data-live-brand><option value="all">All collections</option></select></label>
          <label><span>Style</span><select data-live-style><option value="all">All styles</option><option value="embroidered">Embroidered</option><option value="non-embroidered">Printed / non-embroidered</option><option value="unknown">Price on enquiry</option></select></label>
          <label><span>Pieces</span><select data-live-pieces><option value="all">All suit types</option><option value="2 Piece">2 Piece</option><option value="3 Piece">3 Piece</option></select></label>
          <label><span>Price</span><select data-live-price><option value="all">All prices</option><option value="0-3999">Under Rs. 4,000</option><option value="4000-5999">Rs. 4,000–5,999</option><option value="6000-7999">Rs. 6,000–7,999</option><option value="8000-999999">Rs. 8,000+</option><option value="enquire">Price on enquiry</option></select></label>
          <label><span>Availability</span><select data-live-availability><option value="available">Available to order</option><option value="all">Show all</option><option value="unavailable">Currently unavailable</option></select></label>
          <label><span>Sort</span><select data-live-sort><option value="newest">Newest first</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name: A–Z</option></select></label>
        </div>
        <div class="live-filter-summary"><p class="live-results" data-live-results>Loading latest designs…</p><div class="live-chips" data-live-chips></div><button type="button" data-live-clear>Clear all</button></div>
        <div class="live-product-grid" data-live-grid></div>
        <button class="button button-gold live-load-more" type="button" data-live-more hidden>View more designs</button>
      </section>

`;

const nav = `        <details class="live-nav-dropdown" data-live-nav>
          <summary>Collections <span aria-hidden="true">⌄</span></summary>
          <div class="live-nav-menu"><a class="live-nav-all" href="#live-catalogue">View all collections</a><div class="live-nav-groups" data-live-nav-groups><span>Loading collections…</span></div></div>
        </details>
        <a href="#live-catalogue">New arrivals</a>
        <a href="#how-to-order">How to order</a>
`;

const ordering = `      <section class="order-steps section-pad" id="how-to-order" aria-labelledby="order-title">
        <div class="order-heading reveal"><p class="eyebrow dark"><span></span> Personal service</p><h2 id="order-title">How to<br /><em>order.</em></h2><p>From catalogue to confirmation in three simple steps.</p></div>
        <div class="order-grid reveal">
          <article><span>01</span><h3>Choose a design</h3><p>Browse the latest collection and open your preferred suit to review its images, code, price and availability.</p></article>
          <article><span>02</span><h3>Message our team</h3><p>Use the product’s WhatsApp button. Its name and code will be included automatically in your message.</p></article>
          <article><span>03</span><h3>Confirm your order</h3><p>Our team will confirm availability, payment and delivery information before your order is finalized.</p></article>
        </div>
        <p class="order-note">Catalogue availability is synchronized from our approved supplier source. Please obtain final confirmation from our team before payment.</p>
      </section>

`;

function insertBefore(needle, content, description) {
  if (!html.includes(needle)) throw new Error(`Could not locate ${description}; refusing to alter index.html.`);
  html = html.replace(needle, `${content}${needle}`);
}

function sectionBounds(id) {
  const marker = `id="${id}"`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = html.lastIndexOf('<section', markerIndex);
  const end = html.indexOf('</section>', markerIndex);
  return start >= 0 && end >= 0 ? [start, end + '</section>'.length] : null;
}

function replaceSection(id, content) {
  const bounds = sectionBounds(id);
  if (!bounds) return false;
  html = `${html.slice(0, bounds[0])}${content.trimEnd()}${html.slice(bounds[1])}`;
  return true;
}

function removeSection(id) {
  const bounds = sectionBounds(id);
  if (bounds) html = `${html.slice(0, bounds[0])}${html.slice(bounds[1])}`;
}

if (!html.includes('href="dawood-catalogue.css"')) insertBefore('</head>', '    <link rel="stylesheet" href="dawood-catalogue.css" />\n  ', 'document head');
if (!html.includes('href="dawood-commerce.css"')) insertBefore('</head>', '    <link rel="stylesheet" href="dawood-commerce.css" />\n  ', 'document head');
if (!html.includes('src="dawood-catalogue.js"')) insertBefore('</body>', '    <script src="dawood-catalogue.js" defer></script>\n  ', 'document body');
if (!html.includes('src="dawood-commerce.js"')) insertBefore('</body>', '    <script src="dawood-commerce.js" defer></script>\n  ', 'document body');
if (!html.includes('src="analytics.js"')) insertBefore('</body>', '    <script src="analytics.js" defer></script>\n  ', 'document body');

if (!replaceSection('live-catalogue', catalogueSection)) {
  insertBefore('      <section class="catalogue section-pad" id="catalogue"', catalogueSection, 'existing catalogue section');
}

// The PDF catalogue is retained in repository history, but removed from the delivered page.
removeSection('featured');
removeSection('catalogue');
removeSection('recently-viewed');

if (!html.includes('data-live-nav')) {
  const dropdownStart = Math.max(html.indexOf('<div class="nav-dropdown" data-collection-menu>'), html.indexOf('<div class="nav-dropdown pdf-catalogue-archive" data-collection-menu>'));
  const catalogueLink = html.indexOf('<a href="#live-catalogue">Catalogue</a>', dropdownStart);
  if (dropdownStart >= 0 && catalogueLink >= 0) {
    const linkEnd = catalogueLink + '<a href="#live-catalogue">Catalogue</a>'.length;
    html = `${html.slice(0, dropdownStart)}${nav}${html.slice(linkEnd)}`;
  } else insertBefore('        <a href="#contact">Contact</a>', nav, 'contact navigation link');
}

if (!html.includes('id="how-to-order"')) insertBefore('      <section class="faq-section', ordering, 'FAQ section');

if (!html.includes('class="social-contact"')) {
  insertBefore('          <div class="contact-map">', `          <div class="social-contact" aria-label="Al Huma Collection social media">
            <p><span>Follow &amp; message us</span>Connect with Al Huma Collection on your preferred social platform.</p>
            <div>
              <a href="https://www.facebook.com/Alhuma.Collection" target="_blank" rel="noopener noreferrer" aria-label="Contact Al Huma Collection on Facebook"><b aria-hidden="true">f</b><span>Facebook<small>Al Huma</small></span><i>Visit page ↗</i></a>
              <a href="https://www.instagram.com/alhuma.collection/" target="_blank" rel="noopener noreferrer" aria-label="Contact Al Huma Collection on Instagram"><b aria-hidden="true">◎</b><span>Instagram<small>@alhuma.collection</small></span><i>Visit profile ↗</i></a>
            </div>
          </div>
`, 'contact map');
}

const enquirySelectStart = html.indexOf('<label>Collection<select name="collection"');
const enquirySelectEnd = html.indexOf('</select></label>', enquirySelectStart);
if (enquirySelectStart >= 0 && enquirySelectEnd > enquirySelectStart) {
  const replacement = '<label>Preferred collection<select name="collection" data-live-enquiry-collection><option value="Help me choose">Help me choose</option></select><small class="field-help">Choose a current brand, or let our team guide you.</small></label>';
  html = `${html.slice(0, enquirySelectStart)}${replacement}${html.slice(enquirySelectEnd + '</select></label>'.length)}`;
}

html = html.replace('href="#featured">Catalogue</a>', 'href="#live-catalogue">New arrivals</a>');
html = html.replace('href="#featured">Explore featured collections</a>', 'href="#live-catalogue">Explore latest designs</a>');
html = html.replace('href="#catalogue">Catalogue</a>', 'href="#live-catalogue">Catalogue</a>');
html = html.replace('© 2026 Al Huma Collection. Concept landing page.', '© 2026 Al Huma Collection. All rights reserved.');
html = html.replace('<a href="#story">Story</a><a href="#live-catalogue">Catalogue</a><a href="#contact">Contact</a>', '<a href="#story">Story</a><a href="#live-catalogue">Catalogue</a><a href="#how-to-order">How to order</a><a href="policies.html">Policies</a><a href="#contact">Contact</a>');
if (!html.includes('href="https://www.facebook.com/Alhuma.Collection" target="_blank" rel="noopener noreferrer">Facebook</a>')) {
  html = html.replace('<a href="policies.html">Policies</a><a href="#contact">Contact</a>', '<a href="policies.html">Policies</a><a href="#contact">Contact</a><a href="https://www.facebook.com/Alhuma.Collection" target="_blank" rel="noopener noreferrer">Facebook</a><a href="https://www.instagram.com/alhuma.collection/" target="_blank" rel="noopener noreferrer">Instagram</a>');
}

html = html.replace(
  '<details><summary>Why are prices not displayed?<span>+</span></summary><p>Prices are shared through a personal WhatsApp consultation so our team can provide the latest information for your selected design.</p></details>',
  '<details><summary>Are the displayed prices current?<span>+</span></summary><p>Calculated retail prices are refreshed with the synchronized catalogue approximately every 12 hours. Where a product cannot be classified confidently, its price is withheld and our team will assist on WhatsApp.</p></details>'
);
html = html.replace('Products displayed on the website are marked in stock. Please contact our team on WhatsApp at +92 321 6115731 for final confirmation before ordering.', 'Availability is synchronized approximately every 12 hours and means available to order from our approved supplier source. Please contact our team on WhatsApp at +92 321 6115731 for final confirmation.');
html = html.replace(
  "addChatMessage('Prices are shared privately. Please send the product name or code to our official WhatsApp team for the current price.', 'assistant', [",
  "addChatMessage('Calculated retail prices are displayed with confidently classified products. If a price is marked for enquiry, our official WhatsApp team will assist using the product code.', 'assistant', ["
);
html = html.replace("{ label: 'Ask for price', href: generalWhatsApp, external: true }", "{ label: 'Enquire on WhatsApp', href: generalWhatsApp, external: true }");

// Remove obsolete PDF-catalogue behaviour and safely detach its former menu.
const oldCatalogueJsStart = html.indexOf("const collectionRail = document.querySelector('[data-collection-rail]');");
const oldCatalogueJsEnd = html.indexOf("const chatLauncher = document.querySelector('[data-chat-launcher]');", oldCatalogueJsStart);
if (oldCatalogueJsStart >= 0 && oldCatalogueJsEnd > oldCatalogueJsStart) {
  html = `${html.slice(0, oldCatalogueJsStart)}${html.slice(oldCatalogueJsEnd)}`;
}
html = html.replace("    collectionMenu.classList.remove('open');\n    collectionToggle.setAttribute('aria-expanded', 'false');", "    collectionMenu?.classList.remove('open');\n    collectionToggle?.setAttribute('aria-expanded', 'false');");
const oldDropdownJsStart = html.indexOf("collectionToggle.addEventListener('click', (event) => {");
const oldDropdownJsEnd = html.indexOf('const openBooking = (collection) => {', oldDropdownJsStart);
if (oldDropdownJsStart >= 0 && oldDropdownJsEnd > oldDropdownJsStart) {
  html = `${html.slice(0, oldDropdownJsStart)}${html.slice(oldDropdownJsEnd)}`;
}

const oldAssistantCatalogueStart = html.indexOf("const catalogueEntries = [...document.querySelectorAll('[data-whatsapp]')]");
const oldAssistantCatalogueEnd = html.indexOf('const includesAny = (question, terms)', oldAssistantCatalogueStart);
if (oldAssistantCatalogueStart >= 0 && oldAssistantCatalogueEnd > oldAssistantCatalogueStart) {
  const synchronizedAssistantData = `let catalogueEntries = [];
let collectionAnswers = [];
window.addEventListener('alhuma:catalogue-ready', event => {
  const liveProducts = event.detail?.products || [];
  catalogueEntries = liveProducts.map(item => ({ code:item.code, product:item.name, search:normalizeQuestion(\`${'${item.code} ${item.name}'}\`), href:item.whatsapp, available:item.available, priceLabel:item.priceLabel }));
  collectionAnswers = [...new Set(liveProducts.map(item => item.brand).filter(Boolean))].map(name => ({ terms:[normalizeQuestion(name)], name, href:'#live-catalogue' }));
});
`;
  html = `${html.slice(0, oldAssistantCatalogueStart)}${synchronizedAssistantData}${html.slice(oldAssistantCatalogueEnd)}`;
}
html = html.replace(
  "addChatMessage(`${product.product} (${product.code}) is shown as In stock. Our showroom team can confirm the latest availability and price on WhatsApp.`, 'assistant', [",
  "addChatMessage(`${product.product} (${product.code}) is ${product.available ? 'available to order' : 'currently unavailable'}. ${product.priceLabel}`, 'assistant', ["
);
html = html.replace("{ label: 'Browse products', href: '#catalogue' }", "{ label: 'Browse products', href: '#live-catalogue' }");
html = html.replace('All products currently displayed are marked In stock. Please ask our WhatsApp team to confirm before ordering.', 'Availability is synchronized approximately every 12 hours. Products marked “Available to order” still require final confirmation from our WhatsApp team.');
html = html.replace('Our showroom catalogue has 9 featured collections and 98 products. Select a collection to see its designs.', 'Browse our synchronized Formal and Luxury collections, updated approximately every 12 hours. Use the catalogue filters to choose a brand or style.');
html = html.replace("{ label: 'View catalogue', href: '#catalogue' }", "{ label: 'View catalogue', href: '#live-catalogue' }");
html = html.replace('Ask our showroom team for pricing and ordering details.', 'Ask our team for pricing and ordering details.');

html = html.replace('<title>Al Huma Collection — Quietly Iconic</title>', '<title>Al Huma Collection | Unstitched Formal & Luxury Suits in Sialkot</title>');
html = html.replace('content="Al Huma Collection — refined Pakistani womenswear, shaped by timeless silhouettes and expressive detail."', 'content="Shop unstitched formal and luxury ladies suits from Al Huma Collection in Model Town, Sialkot. Browse current designs, prices and availability, then order on official WhatsApp."');

if (!html.includes('rel="canonical"')) insertBefore('</head>', `    <link rel="canonical" href="https://alhumacollection.com/" />
    <link rel="icon" href="favicon.svg" type="image/svg+xml" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Al Huma Collection | Formal & Luxury Unstitched Suits" />
    <meta property="og:description" content="Browse synchronized formal and luxury ladies suit collections with current prices and WhatsApp ordering." />
    <meta property="og:url" content="https://alhumacollection.com/" />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"ClothingStore","name":"Al Huma Collection","url":"https://alhumacollection.com/","email":"alhumacollection@gmail.com","telephone":"+923216115731","address":{"@type":"PostalAddress","streetAddress":"87 Peer, Muradia Rd, Model Town","addressLocality":"Sialkot","addressCountry":"PK"},"priceRange":"PKR"}</script>
  `, 'document head');

await fs.writeFile(file, html);
console.log(`Dawood catalogue integration installed; index.html is ${Buffer.byteLength(html).toLocaleString()} bytes.`);
