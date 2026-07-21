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

if (!html.includes('href="dawood-catalogue.css"')) insertBefore('</head>', '    <link rel="stylesheet" href="dawood-catalogue.css" />\n  ', 'document head');
if (!html.includes('href="dawood-commerce.css"')) insertBefore('</head>', '    <link rel="stylesheet" href="dawood-commerce.css" />\n  ', 'document head');
if (!html.includes('href="header-cart.css"')) insertBefore('</head>', '    <link rel="stylesheet" href="header-cart.css" />\n  ', 'document head');
if (!html.includes('href="reviews.css"')) insertBefore('</head>', '    <link rel="stylesheet" href="reviews.css" />\n  ', 'document head');
if (!html.includes('src="dawood-catalogue.js"')) insertBefore('</body>', '    <script src="dawood-catalogue.js" defer></script>\n  ', 'document body');
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
html = html.replace('Welcome to Al Huma Collection. Ask me about our collections, a product code, availability, ordering or the showroom location.', 'Welcome to Al Huma Collection. I can calculate live catalogue price ranges, find products within your budget, check availability, and explain COD ordering, delivery or cancellation.');
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
