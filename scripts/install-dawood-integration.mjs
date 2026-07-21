import fs from 'node:fs/promises';

const file = 'index.html';
let html = await fs.readFile(file, 'utf8');

const section = `      <section class="live-catalogue section-pad" id="live-catalogue" aria-labelledby="live-catalogue-title" data-live-catalogue hidden>
        <div class="live-catalogue-head reveal">
          <div>
            <p class="eyebrow"><span></span> Synchronized catalogue</p>
            <h2 id="live-catalogue-title">Latest<br /><em>designs.</em></h2>
          </div>
          <div class="live-catalogue-summary">
            <p>Explore the latest unstitched formal and luxury collections. Prices shown are Al Huma Collection retail prices, and availability is refreshed approximately every 12 hours.</p>
            <div class="live-sync-meta"><span data-live-sync-time>Preparing catalogue</span><span>WhatsApp ordering</span></div>
          </div>
        </div>
        <div class="live-tools" aria-label="Search and filter synchronized catalogue">
          <label><span>Search designs</span><input type="search" placeholder="Product, brand or code" autocomplete="off" data-live-search /></label>
          <label><span>Category</span><select data-live-category><option value="all">All categories</option><option value="Formal">Formal</option><option value="Luxury">Luxury</option></select></label>
          <label><span>Availability</span><select data-live-availability><option value="available">Available now</option><option value="all">Show all</option><option value="unavailable">Currently unavailable</option></select></label>
        </div>
        <p class="live-results" data-live-results>Loading latest designs…</p>
        <div class="live-product-grid" data-live-grid></div>
        <button class="button button-gold live-load-more" type="button" data-live-more hidden>View more designs</button>
      </section>

`;

function insertBefore(needle, content, description) {
  if (!html.includes(needle)) throw new Error(`Could not locate ${description}; refusing to alter index.html.`);
  html = html.replace(needle, `${content}${needle}`);
}

if (!html.includes('href="dawood-catalogue.css"')) {
  insertBefore('</head>', '    <link rel="stylesheet" href="dawood-catalogue.css" />\n  ', 'document head');
}

if (!html.includes('id="live-catalogue"')) {
  insertBefore('      <section class="catalogue section-pad" id="catalogue"', section, 'existing catalogue section');
}

if (!html.includes('src="dawood-catalogue.js"')) {
  insertBefore('</body>', '    <script src="dawood-catalogue.js" defer></script>\n  ', 'document body');
}

html = html.replace('href="#featured">Catalogue</a>', 'href="#live-catalogue">Catalogue</a>');
html = html.replace('href="#featured">Explore featured collections</a>', 'href="#live-catalogue">Explore latest designs</a>');
html = html.replace('href="#catalogue">Catalogue</a>', 'href="#live-catalogue">Catalogue</a>');

html = html.replace('<div class="nav-dropdown" data-collection-menu>', '<div class="nav-dropdown pdf-catalogue-archive" data-collection-menu>');
html = html.replace('<section class="featured-collections section-pad" id="featured"', '<section class="featured-collections section-pad pdf-catalogue-archive" id="featured"');
html = html.replace('<section class="catalogue section-pad" id="catalogue"', '<section class="catalogue section-pad pdf-catalogue-archive" id="catalogue"');
html = html.replace('<section class="recently-viewed section-pad"', '<section class="recently-viewed section-pad pdf-catalogue-archive"');

html = html.replace(
  '<details><summary>Why are prices not displayed?<span>+</span></summary><p>Prices are shared through a personal WhatsApp consultation so our team can provide the latest information for your selected design.</p></details>',
  '<details><summary>Are the displayed prices current?<span>+</span></summary><p>Yes. Our displayed retail prices are refreshed with the synchronized catalogue approximately every 12 hours. Please contact our team on WhatsApp to confirm availability before ordering.</p></details>'
);
html = html.replace(
  "addChatMessage('Prices are shared privately. Please send the product name or code to our official WhatsApp team for the current price.', 'assistant', [",
  "addChatMessage('Current retail prices are displayed with each synchronized product. Please contact our official WhatsApp team with the product code to confirm availability and place your order.', 'assistant', ["
);
html = html.replace("{ label: 'Ask for price', href: generalWhatsApp, external: true }", "{ label: 'Order on WhatsApp', href: generalWhatsApp, external: true }");
await fs.writeFile(file, html);
console.log('Dawood catalogue integration is installed in index.html.');
