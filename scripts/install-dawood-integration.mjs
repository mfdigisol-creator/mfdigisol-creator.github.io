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
        <div class="order-heading reveal"><p class="eyebrow dark"><span></span> Two easy ways to order</p><h2 id="order-title">How to<br /><em>order.</em></h2><p>Order through our website checkout or speak with us directly on WhatsApp.</p></div>
        <div class="order-grid reveal">
          <article><span>01</span><h3>Choose a design</h3><p>Browse the latest collection and open your preferred suit to review its images, product code, displayed price and availability.</p></article>
          <article><span>02</span><h3>Select your ordering method</h3><p><strong>Website:</strong> choose “Add to cart,” review your items and complete the COD checkout. <strong>WhatsApp:</strong> choose the WhatsApp button to send the product name and code directly to our team.</p></article>
          <article><span>03</span><h3>Confirm and receive</h3><p>Our team will call to confirm availability, final charges and delivery details before dispatch through TCS or Leopards Courier. Payment is Cash on Delivery.</p></article>
        </div>
        <p class="order-note">Standard delivery for parcels up to 1 kg is Rs. 300 within Sialkot and Rs. 600 outside Sialkot. Charges may increase for heavier or larger parcels and will be confirmed by our team. Estimated delivery is up to 7 days after confirmation and may vary due to unforeseen circumstances. To cancel before the confirmation call, WhatsApp your order details to +92 321 6115731.</p>
      </section>

`;

const faqSection = `      <section class="faq-section section-pad" id="faq" aria-labelledby="faq-title">
        <div class="faq-intro reveal"><p class="eyebrow dark"><span></span> Helpful information</p><h2 id="faq-title">Frequently<br /><em>asked.</em></h2><p>Everything you need before choosing and ordering your next Al Huma design.</p></div>
        <div class="faq-list reveal">
          <details><summary>How can I place an order?<span>+</span></summary><p>You can order in either of two ways. For website checkout, select “Add to cart,” review your cart and complete the Pakistan COD order form. For personal assistance, select the product’s WhatsApp button; its name and product code will be prepared automatically for you to send to our team.</p></details>
          <details><summary>Will products remain in my cart if I leave the website?<span>+</span></summary><p>Yes. Your cart is saved in the browser on that device and will be restored when you return. Products remain until you remove them yourself or successfully place the order.</p></details>
          <details><summary>Which payment method is available?<span>+</span></summary><p>We currently offer Cash on Delivery within Pakistan. No online card payment or advance payment gateway is required. Our team will call before dispatch to confirm availability and final charges.</p></details>
          <details><summary>What are the delivery charges and delivery time?<span>+</span></summary><p>For parcels up to 1 kg, standard delivery is Rs. 300 within Sialkot and Rs. 600 outside Sialkot. Charges may increase depending on weight or volume and will be communicated during the confirmation call. Orders are normally delivered within 7 days after confirmation through TCS or Leopards Courier, although unforeseen circumstances may cause delays.</p></details>
          <details><summary>Can I cancel my order?<span>+</span></summary><p>You may request cancellation before our confirmation call. WhatsApp your order number and order details to our official number, +92 321 6115731. Once the order has been confirmed or dispatched, the applicable customer policies will apply.</p></details>
          <details><summary>Are the displayed prices current?<span>+</span></summary><p>Displayed retail prices are refreshed with the synchronized catalogue approximately every 12 hours. Products whose classification cannot be confirmed show “Price on enquiry” instead of a guessed price. Availability and final charges are confirmed by our team before dispatch.</p></details>
          <details><summary>Are these suits stitched or unstitched?<span>+</span></summary><p>The products presented in the current catalogue are unstitched suit designs. Please review each product’s listed details and images for its pieces and design information.</p></details>
          <details><summary>How can I confirm availability?<span>+</span></summary><p>Availability is synchronized approximately every 12 hours and means available to order from our approved supplier source. Our team confirms final availability after receiving your website or WhatsApp order.</p></details>
          <details><summary>Where is Al Huma Collection located?<span>+</span></summary><p>Visit us at 87 Peer, Muradia Rd, Model Town, Sialkot, Pakistan. Directions and our official contact channels are available in the contact section below.</p></details>
        </div>
      </section>

`;

const reviews = `      <section class="customer-reviews section-pad" id="reviews" aria-labelledby="reviews-title">
        <div class="reviews-heading reveal"><p class="eyebrow dark"><span></span> Customer voices</p><h2 id="reviews-title">Shared with<br /><em>confidence.</em></h2><p>Only customer reviews approved by Al Huma Collection are published. Submit your genuine experience for moderation.</p></div>
        <div class="trust-grid" aria-label="Why shop with Al Huma Collection"><article><b>01</b><strong>Cash on Delivery</strong><span>Order within Pakistan and pay when your parcel arrives.</span></article><article><b>02</b><strong>Personal confirmation</strong><span>Our team confirms availability and final charges before dispatch.</span></article><article><b>03</b><strong>Official support</strong><span>Order assistance through our verified WhatsApp number.</span></article></div>
        <div class="approved-reviews" data-approved-reviews><p>Loading approved reviews…</p></div>
        <form class="review-form reveal" action="https://formsubmit.co/alhumacollection@gmail.com" method="POST">
          <input type="hidden" name="_subject" value="New customer review — approval required"><input type="hidden" name="_captcha" value="true"><input type="hidden" name="_next" value="https://alhumacollection.com/review-thanks.html">
          <div class="review-form-head"><div><span>Share your experience</span><h3>Leave a review</h3></div><p>Your review is sent privately to our team and appears publicly only after moderation.</p></div>
          <fieldset><legend>Rating</legend><div class="rating-input"><input id="rate5" type="radio" name="Rating" value="5 stars" required><label for="rate5" title="5 stars">★</label><input id="rate4" type="radio" name="Rating" value="4 stars"><label for="rate4" title="4 stars">★</label><input id="rate3" type="radio" name="Rating" value="3 stars"><label for="rate3" title="3 stars">★</label><input id="rate2" type="radio" name="Rating" value="2 stars"><label for="rate2" title="2 stars">★</label><input id="rate1" type="radio" name="Rating" value="1 star"><label for="rate1" title="1 star">★</label></div></fieldset>
          <label>Display name<input name="Display name" required maxlength="60" placeholder="Your first name or preferred public name"></label><label>City (optional)<input name="City" maxlength="60" placeholder="e.g. Sialkot"></label><label>Order ID (optional)<input name="Order ID" maxlength="30" placeholder="e.g. AH-12345678"></label><label class="review-wide">Your review<textarea name="Review" required minlength="20" maxlength="700" rows="5" placeholder="Tell us about the product, ordering experience or service you received."></textarea></label>
          <label class="review-consent review-wide"><span><input type="checkbox" name="Publication consent" value="Approved" required> This is my genuine experience, and I allow Al Huma Collection to publish my display name, city, rating and review after moderation.</span></label><button class="button button-dark review-wide" type="submit">Submit review for approval</button>
        </form>
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

// Keep the enquiry dialog inside narrow mobile viewports, including older Android browsers.
html = html.replace(
  /\.booking-dialog \{ width: (?:min\(580px, calc\(100vw - 2rem\)\)|calc\(100% - 2rem\));[^}]*\}/,
  '.booking-dialog { width: calc(100% - 2rem); max-width: 580px; max-height: calc(100dvh - 1rem); margin: auto; padding: clamp(2rem, 5vw, 4rem); border: 1px solid #d6c8ad; background: var(--paper); color: var(--ink); box-shadow: 0 30px 100px rgba(0,0,0,.5); overflow-x: hidden; overflow-y: auto; }'
);
html = html.replace(
  /\.booking-dialog input, \.booking-dialog select \{ (?:display: block; )?width: 100%;[^}]*\}/,
  '.booking-dialog input, .booking-dialog select { display: block; width: 100%; max-width: 100%; min-width: 0; margin-top: .45rem; padding: .85rem 0; border: 0; border-bottom: 1px solid #bbae98; border-radius: 0; outline: 0; background: transparent; color: var(--ink); font-size: .9rem; text-transform: none; letter-spacing: 0; }'
);

if (!html.includes('href="dawood-catalogue.css"')) insertBefore('</head>', '    <link rel="stylesheet" href="dawood-catalogue.css" />\n  ', 'document head');

const mobileDialogFix = `
  .booking-dialog { position: fixed; inset: .5rem; width: auto; max-width: none; max-height: none; margin: 0; padding: 1.35rem 1.1rem; }
  .booking-dialog h2 { margin-right: 2.5rem; font-size: clamp(2rem, 12vw, 3rem); overflow-wrap: anywhere; }
  .booking-dialog form, .booking-dialog label, .booking-dialog .captcha-field { min-width: 0; }
  .captcha-field > div { grid-template-columns: minmax(0, 1fr) 72px; gap: .65rem; }
`;
if (!html.includes('position: fixed; inset: .5rem; width: auto; max-width: none; max-height: none')) {
  html = html.replace('@media (max-width: 620px) {', `@media (max-width: 620px) {\n${mobileDialogFix}`);
}
if (!html.includes('href="dawood-commerce.css"')) insertBefore('</head>', '    <link rel="stylesheet" href="dawood-commerce.css" />\n  ', 'document head');
if (!html.includes('href="header-cart.css"')) insertBefore('</head>', '    <link rel="stylesheet" href="header-cart.css" />\n  ', 'document head');
if (!html.includes('href="reviews.css"')) insertBefore('</head>', '    <link rel="stylesheet" href="reviews.css" />\n  ', 'document head');
if (!html.includes('href="mobile-responsive.css"')) insertBefore('</head>', '    <link rel="stylesheet" href="mobile-responsive.css" />\n  ', 'document head');
if (!html.includes('src="dawood-catalogue.js')) insertBefore('</body>', '    <script src="dawood-catalogue.js?v=20260722-auto-clear-filters" defer></script>\n  ', 'document body');
html = html.replace(/src="dawood-catalogue\.js(?:\?[^\"]*)?"/g, 'src="dawood-catalogue.js?v=20260722-auto-clear-filters"');
if (!html.includes('src="dawood-commerce.js"')) insertBefore('</body>', '    <script src="dawood-commerce.js" defer></script>\n  ', 'document body');
if (!html.includes('src="reviews.js"')) insertBefore('</body>', '    <script src="reviews.js" defer></script>\n  ', 'document body');
if (!html.includes('src="analytics.js"')) insertBefore('</body>', '    <script src="analytics.js" defer></script>\n  ', 'document body');

if (!replaceSection('live-catalogue', catalogueSection)) {
  insertBefore('      <section class="catalogue section-pad" id="catalogue"', catalogueSection, 'existing catalogue section');
}
if (!replaceSection('reviews', reviews)) insertBefore('      <section class="collections section-pad" id="visit">', reviews, 'visit section');

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

if (!replaceSection('how-to-order', ordering)) insertBefore('      <section class="faq-section', ordering, 'FAQ section');
replaceSection('faq', faqSection);

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

const assistantStart = html.indexOf('let catalogueEntries = [];');
const assistantEnd = html.indexOf('const setChatOpen = open => {', assistantStart);
if (assistantStart >= 0 && assistantEnd > assistantStart) {
  const enhancedAssistant = `let catalogueEntries = [];
let catalogueProducts = [];
let collectionAnswers = [];
let catalogueUpdatedAt = null;
const chatMoney = value => 'Rs. ' + Number(value).toLocaleString('en-PK');
const productRange = list => {
  const prices = list.filter(item => item.available && Number.isFinite(item.price)).map(item => item.price);
  return prices.length ? { min:Math.min(...prices), max:Math.max(...prices), count:prices.length } : null;
};
const rangeText = range => range ? \`\${chatMoney(range.min)} to \${chatMoney(range.max)}\` : 'price on enquiry';
window.addEventListener('alhuma:catalogue-ready', event => {
  catalogueProducts = event.detail?.products || [];
  catalogueUpdatedAt = event.detail?.synchronizedAt || null;
  catalogueEntries = catalogueProducts.map(item => ({ ...item, product:item.name, search:normalizeQuestion(\`\${item.code} \${item.name}\`), href:item.whatsapp }));
  collectionAnswers = [...new Set(catalogueProducts.map(item => item.brand).filter(Boolean))].map(name => ({ terms:[normalizeQuestion(name)], name, products:catalogueProducts.filter(item => item.brand === name), href:'#live-catalogue' }));
});
const includesAny = (question, terms) => terms.some(term => question.includes(term));
const assistantActions = [{ label:'Browse catalogue', href:'#live-catalogue' }, { label:'Ask our team', href:generalWhatsApp, external:true }];

const answerChatQuestion = rawQuestion => {
  const question = normalizeQuestion(rawQuestion);
  const product = catalogueEntries.find(item => {
    const code = normalizeQuestion(item.code), name = normalizeQuestion(item.product);
    return question.includes(code) || (name.length > 7 && question.includes(name));
  });
  if (product) {
    addChatMessage(\`\${product.product} (\${product.code}) is \${product.available ? 'available to order' : 'currently unavailable'}. \${product.priceLabel} It is a \${product.pieceType || 'suit'} from \${product.brand}.\`, 'assistant', [{ label:'Ask about this product', href:product.href, external:true }]);
    return;
  }

  if (includesAny(question,['fabric quality','fabric','cloth quality','material quality','kapra','kapray','quality kaisi','quality of suit'])) {
    addChatMessage('Fabric and finishing vary by brand, collection and design, so we prefer product-specific guidance instead of making one general quality claim. Al Huma Collection curates established Pakistani unstitched collections and clearly identifies the brand, product code, suit type and embroidery classification where available. Before confirmation, our team can help you review the listed fabric details, components, design images and intended use so you can choose with confidence. Photography and screens can affect colour appearance, and final product details should always be confirmed using the product code.', 'assistant', [{label:'Browse product details',href:'#live-catalogue'},{label:'Ask about a fabric',href:generalWhatsApp,external:true}]);
    return;
  }

  if (includesAny(question,['why al huma','why should i buy','why buy from','why choose','al huma se kyun','ap se kyun','direct from brand','brand directly','brand website','official website','instead of brand'])) {
    addChatMessage('Buying directly from a single brand can be suitable when you already know exactly what you want. Al Huma Collection is valuable when you prefer to compare multiple Formal and Luxury brands in one curated catalogue, receive personal help with product codes and availability, use Cash on Delivery within Pakistan, and speak with a local Sialkot team before dispatch. Our catalogue information is synchronized from an approved supplier source, displayed prices are transparent where classification is confident, and uncertain prices are never guessed. We do not claim every design is cheaper than every brand; our value is choice, convenience, personal confirmation and accessible after-order support.', 'assistant', [{label:'Explore our collections',href:'#live-catalogue'},{label:'Speak with our team',href:generalWhatsApp,external:true}]);
    return;
  }

  if (includesAny(question,['compare','comparison','versus',' vs ','marketplace','market place','other shop','other website','daraz','competitor','different brand','better than','cheaper than'])) {
    addChatMessage('We respect other brands, shops and marketplaces, and recommend a like-for-like comparison using the exact product code, brand, collection, number of pieces, embroidery or print classification, listed fabric details, availability, delivery charges and customer support. Al Huma Collection’s difference is a curated multi-brand selection, synchronized catalogue information, clear product codes, personal confirmation, Pakistan-wide COD, and direct support through our official WhatsApp and Sialkot location. We avoid claiming that every product is automatically better or cheaper; we help you compare accurately and choose the design and service that best suit your needs.', 'assistant', [{label:'Compare current designs',href:'#live-catalogue'},{label:'Ask our team',href:generalWhatsApp,external:true}]);
    return;
  }

  if (includesAny(question,['trust','genuine','original','authentic','reliable','safe to order','fraud','scam'])) {
    addChatMessage('Al Huma Collection supports confident ordering through identifiable product codes, synchronized supplier catalogue information, visible pricing where classification is reliable, Cash on Delivery, and a confirmation call before dispatch. You can contact us through our official WhatsApp, email, social profiles or visit our Model Town, Sialkot location. Product availability and final charges are confirmed before the order is finalized.', 'assistant', [{label:'Our contact details',href:'#contact'},{label:'Read customer policies',href:'policies.html'}]);
    return;
  }

  const collection = collectionAnswers.find(item => item.terms.some(term => question.includes(term)));
  const asksPrice = includesAny(question, ['price','prices','cost','range','rate','how much','cheapest','expensive','budget','under','below','upto','up to']);
  if (collection) {
    const available = collection.products.filter(item => item.available), range = productRange(collection.products);
    addChatMessage(asksPrice ? \`\${collection.name} currently has \${available.length} available design\${available.length === 1 ? '' : 's'}. Displayed prices range from \${rangeText(range)}; products that cannot be classified confidently remain “Price on enquiry.”\` : \`\${collection.name} currently has \${available.length} design\${available.length === 1 ? '' : 's'} available to order. Use the Collection filter to view them; final availability is confirmed by our team.\`, 'assistant', assistantActions);
    return;
  }

  const cleanNumber = rawQuestion.replace(/,/g,'');
  const amountMatch = cleanNumber.match(/(?:rs\\.?|pkr|rupees?)?\\s*(\\d{3,6})/i);
  const amount = amountMatch ? Number(amountMatch[1]) : null;
  if (amount && includesAny(question,['under','below','upto','up to','budget','within','less than'])) {
    const matches = catalogueProducts.filter(item => item.available && Number.isFinite(item.price) && item.price <= amount).sort((a,b) => b.price-a.price);
    const examples = matches.slice(0,3).map(item => \`\${item.name} (\${item.code}) — \${chatMoney(item.price)}\`).join('; ');
    addChatMessage(matches.length ? \`I found \${matches.length} currently available design\${matches.length === 1 ? '' : 's'} priced up to \${chatMoney(amount)}. Examples: \${examples}. Use the price filters for the full selection.\` : \`I could not find a currently available design with a displayed price up to \${chatMoney(amount)}. Some designs are marked “Price on enquiry,” so our team may still help.\`, 'assistant', assistantActions);
    return;
  }

  if (asksPrice) {
    const all = productRange(catalogueProducts), formal = productRange(catalogueProducts.filter(item => item.category === 'Formal')), luxury = productRange(catalogueProducts.filter(item => item.category === 'Luxury'));
    const known = catalogueProducts.filter(item => item.available && Number.isFinite(item.price));
    if (includesAny(question,['cheapest','lowest','minimum']) && known.length) {
      const item = [...known].sort((a,b)=>a.price-b.price)[0];
      addChatMessage(\`The lowest currently displayed price is \${chatMoney(item.price)} for \${item.name} (\${item.code}). Availability still requires confirmation.\`, 'assistant', [{label:'Ask about this product',href:item.whatsapp,external:true}]); return;
    }
    if (includesAny(question,['expensive','highest','maximum']) && known.length) {
      const item = [...known].sort((a,b)=>b.price-a.price)[0];
      addChatMessage(\`The highest currently displayed price is \${chatMoney(item.price)} for \${item.name} (\${item.code}). Availability still requires confirmation.\`, 'assistant', [{label:'Ask about this product',href:item.whatsapp,external:true}]); return;
    }
    addChatMessage(\`For currently available products with displayed prices, the overall range is \${rangeText(all)}. Formal designs range from \${rangeText(formal)}, while Luxury designs range from \${rangeText(luxury)}. Some products remain “Price on enquiry” when classification is uncertain.\`, 'assistant', assistantActions);
  } else if (includesAny(question,['embroidered','embroidery','printed','non embroidered'])) {
    const embroidered = question.includes('embroider'), type = embroidered ? 'embroidered' : 'non-embroidered', list = catalogueProducts.filter(item => item.pricingClass === type), range=productRange(list);
    addChatMessage(\`There are \${list.filter(item=>item.available).length} currently available \${embroidered ? 'embroidered' : 'printed / non-embroidered'} designs. Displayed prices range from \${rangeText(range)}.\`, 'assistant', assistantActions);
  } else if (includesAny(question,['formal','luxury'])) {
    const category = question.includes('luxury') ? 'Luxury' : 'Formal', list=catalogueProducts.filter(item=>item.category===category), range=productRange(list);
    addChatMessage(\`Our synchronized \${category} catalogue currently shows \${list.filter(item=>item.available).length} available designs, with displayed prices from \${rangeText(range)}.\`, 'assistant', assistantActions);
  } else if (includesAny(question,['how many','product count','number of products','total products'])) {
    addChatMessage(\`The synchronized catalogue currently contains \${catalogueProducts.length} products, including \${catalogueProducts.filter(item=>item.available).length} marked available to order.\`, 'assistant', assistantActions);
  } else if (includesAny(question,['delivery','shipping','courier','tcs','leopards','how long','tat'])) {
    addChatMessage('Delivery is normally through TCS or Leopards Courier. Charges are Rs. 300 within Sialkot and Rs. 600 outside Sialkot for parcels up to 1 kg. Charges may increase with weight or volume. Estimated delivery TAT is up to 7 days after confirmation and may vary due to unforeseen circumstances.', 'assistant', [{label:'Delivery policies',href:'policies.html'}]);
  } else if (includesAny(question,['cancel','cancellation'])) {
    addChatMessage('To cancel before the confirmation call, WhatsApp our official number with your order details.', 'assistant', [{label:'Request cancellation',href:'https://wa.me/923216115731?text=Hello%20Al%20Huma%20Collection%2C%20I%20would%20like%20to%20cancel%20my%20order%20before%20the%20confirmation%20call.%20My%20order%20details%20are%3A%20',external:true}]);
  } else if (includesAny(question,['payment','cod','cash on delivery','pay'])) {
    addChatMessage('We currently offer Cash on Delivery within Pakistan. No online card payment is required. Our team calls to confirm availability and final charges before dispatch.', 'assistant', [{label:'How to order',href:'#how-to-order'}]);
  } else if (includesAny(question,['cart','basket','saved product'])) {
    addChatMessage('Use “Add to cart” on any available product. Your cart is saved in this browser until you remove the item or successfully place the order.', 'assistant', [{label:'Browse products',href:'#live-catalogue'}]);
  } else if (includesAny(question,['review','rating','feedback'])) {
    addChatMessage('You can submit a genuine 1–5 star review in our Customer Voices section. Reviews are sent privately for moderation and published only after approval.', 'assistant', [{label:'Leave a review',href:'#reviews'}]);
  } else if (includesAny(question,['return','exchange','refund'])) {
    addChatMessage('Exchange or return eligibility depends on product condition and the order circumstances. Please inspect the parcel promptly and contact our team with the product code and photographs before returning anything.', 'assistant', [{label:'Read policies',href:'policies.html'},{label:'Contact our team',href:generalWhatsApp,external:true}]);
  } else if (includesAny(question,['order','buy','purchase','book','checkout'])) {
    addChatMessage('Choose an available product, select “Add to cart,” review quantities, and complete the Pakistan COD checkout. Our team will then call to confirm availability, final charges and dispatch.', 'assistant', [{label:'Browse products',href:'#live-catalogue'},{label:'How to order',href:'#how-to-order'}]);
  } else if (includesAny(question,['available','availability','stock'])) {
    addChatMessage(\`Availability is synchronized approximately every 12 hours. \${catalogueProducts.filter(item=>item.available).length} products are currently marked available to order, but our team provides final confirmation before dispatch.\`, 'assistant', assistantActions);
  } else if (includesAny(question,['collection','catalog','catalogue','design','product','brand'])) {
    addChatMessage(\`Browse \${collectionAnswers.length} synchronized brand collections across Formal and Luxury categories. You can filter by collection, style, pieces, price and availability.\`, 'assistant', [{label:'View collections',href:'#live-catalogue'}]);
  } else if (includesAny(question,['location','address','map','shop','visit'])) {
    addChatMessage('Visit Al Huma Collection at 87 Peer, Muradia Rd, Model Town, Sialkot, Pakistan.', 'assistant', [{label:'View contact & map',href:'#contact'}]);
  } else if (includesAny(question,['email','contact','phone','whatsapp','number','facebook','instagram'])) {
    addChatMessage('Contact us on WhatsApp at +92 321 6115731 or email alhumacollection@gmail.com. You can also reach Al Huma on Facebook and @alhuma.collection on Instagram.', 'assistant', [{label:'Open WhatsApp',href:generalWhatsApp,external:true},{label:'Contact details',href:'#contact'}]);
  } else if (includesAny(question,['hello','hi','salam','assalam'])) {
    addChatMessage('Welcome to Al Huma Collection. I can calculate current price ranges, find designs within a budget, check product codes and availability, and explain COD ordering, delivery or cancellation.');
  } else {
    addChatMessage('Thank you for your question. I can help with price ranges, budgets, product codes, collections, availability, COD orders, delivery, cancellation, reviews and our location. For anything more specific, our team will be delighted to assist on official WhatsApp.', 'assistant', [{label:'Contact on WhatsApp',href:generalWhatsApp,external:true}]);
  }
};
`;
  html = `${html.slice(0, assistantStart)}${enhancedAssistant}${html.slice(assistantEnd)}`;
}
if (!html.includes('data-chat-question="What are the current price ranges?"')) {
  html = html.replace('<div class="chat-quick" data-chat-quick>', '<div class="chat-quick" data-chat-quick>\n        <button type="button" data-chat-question="What are the current price ranges?">Price ranges</button>');
}
if (!html.includes('data-chat-question="Why should I buy from Al Huma Collection?"')) {
  html = html.replace('<div class="chat-quick" data-chat-quick>', '<div class="chat-quick" data-chat-quick>\n        <button type="button" data-chat-question="Why should I buy from Al Huma Collection?">Why Al Huma?</button>');
}
html = html.replace('Welcome to Al Huma Collection. Ask me about our collections, a product code, availability, ordering or the showroom location.', 'Welcome to Al Huma Collection. I can calculate live catalogue price ranges, find products within your budget, check availability, and explain COD ordering, delivery or cancellation.');
html = html.replace('Welcome to Al Huma Collection. I can calculate live catalogue price ranges, find products within your budget, check availability, and explain COD ordering, delivery or cancellation.', 'Welcome to Al Huma Collection. I can calculate live price ranges, find products within your budget, discuss fabric guidance, compare shopping options, and explain COD ordering, delivery or cancellation.');
html = html.replace('Guided assistance · For anything else, our team is on WhatsApp.', 'Catalogue-aware guidance · For personal assistance, our team is on WhatsApp.');

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
