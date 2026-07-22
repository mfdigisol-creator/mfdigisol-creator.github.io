(() => {
  const section = document.querySelector('[data-live-catalogue]');
  if (!section) return;

  const $ = selector => section.querySelector(selector);
  const controls = {
    search: $('[data-live-search]'), category: $('[data-live-category]'), brand: $('[data-live-brand]'),
    style: $('[data-live-style]'), pieces: $('[data-live-pieces]'), price: $('[data-live-price]'),
    availability: $('[data-live-availability]'), sort: $('[data-live-sort]')
  };
  const grid = $('[data-live-grid]');
  const results = $('[data-live-results]');
  const chips = $('[data-live-chips]');
  const syncTime = $('[data-live-sync-time]');
  const loadMore = $('[data-live-more]');
  const clear = $('[data-live-clear]');
  const navGroups = document.querySelector('[data-live-nav-groups]');
  const liveNav = document.querySelector('[data-live-nav]');
  const collectionShowcase = $('[data-live-collection-showcase]');
  const collectionSlider = $('[data-live-collection-slider]');
  let products = [];
  const visibleByCollection = new Map();
  const initialCollectionLimit = () => matchMedia('(max-width: 700px)').matches ? 4 : 8;
  const collectionBatchSize = () => matchMedia('(max-width: 700px)').matches ? 6 : 8;

  // This section starts hidden while catalogue data loads. Some Android
  // browsers do not re-trigger observers registered against its hidden
  // descendants, leaving the populated gallery transparent.
  function revealCatalogue() {
    section.querySelectorAll('.reveal').forEach(element => element.classList.add('visible'));
  }

  document.addEventListener('click', event => {
    if (liveNav?.open && !liveNav.contains(event.target)) liveNav.removeAttribute('open');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && liveNav?.open) {
      liveNav.removeAttribute('open');
      liveNav.querySelector('summary')?.focus();
    }
  });
  document.querySelectorAll('.site-nav > a').forEach(link => link.addEventListener('click', () => liveNav?.removeAttribute('open')));

  const money = value => value == null ? 'Price on enquiry' : new Intl.NumberFormat('en-PK', { style:'currency', currency:'PKR', maximumFractionDigits:0 }).format(value).replace('PKR', 'Rs.');
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const slugify = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'design';
  const collectionId = name => `collection-${String(name || 'other-designs').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()}`;
  const thumbnailUrl = (url, width = 600) => {
    try {
      const image = new URL(url, location.href);
      if (image.hostname === 'cdn.shopify.com') image.searchParams.set('width', String(width));
      return image.href;
    } catch { return url; }
  };
  const responsiveImage = (url, alt, { eager = false, width = 600 } = {}) => {
    const source = escapeHtml(url);
    const small = escapeHtml(thumbnailUrl(url, 360));
    const medium = escapeHtml(thumbnailUrl(url, width));
    const large = escapeHtml(thumbnailUrl(url, 900));
    return `<img src="${medium}" srcset="${small} 360w, ${medium} ${width}w, ${large} 900w" sizes="(max-width:700px) 50vw, (max-width:1000px) 33vw, 25vw" alt="${escapeHtml(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager ? ' fetchpriority="high"' : ''} referrerpolicy="no-referrer" data-original-src="${source}" />`;
  };
  const collectionPageUrl = name => {
    const base = slugify(name);
    const collisions = [...new Set(products.map(product => product.brand).filter(Boolean))].sort().filter(brand => slugify(brand) === base);
    const suffix = collisions.indexOf(name);
    return `${location.origin}/collections/${base}${suffix > 0 ? `-${suffix + 1}` : ''}/`;
  };
  const productUrl = product => `${location.origin}/products/${slugify(product.code)}-${slugify(product.productName || product.name)}/`;
  const track = (event, detail = {}) => {
    if (window.AlHumaAnalytics) return window.AlHumaAnalytics.track(event, detail);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...detail });
  };
  const whatsapp = (product, priceQuestion = false) => {
    const priceText = product.price == null || priceQuestion ? 'Please share its current price and' : `It is shown at ${money(product.price)}. Please confirm`;
    return `https://wa.me/923216115731?text=${encodeURIComponent(`Hello Al Huma Collection, I am interested in ${product.name} (${product.code}). ${priceText} availability and ordering details. ${productUrl(product)}`)}`;
  };

  function resetCatalogue({ brand = 'all', renderNow = true } = {}) {
    Object.entries(controls).forEach(([key, control]) => {
      control.value = key === 'availability' ? 'available' : key === 'sort' ? 'newest' : 'all';
    });
    controls.search.value = '';
    controls.brand.value = brand;
    if (renderNow) render();
  }

  function filterProducts() {
    const query = controls.search.value.trim().toLowerCase();
    const priceRange = controls.price.value;
    const matches = products.filter(product => {
      const searchable = `${product.name} ${product.code} ${product.brand} ${product.sourceCollection}`.toLowerCase();
      const priceMatch = priceRange === 'all' || (priceRange === 'enquire' ? product.price == null : (() => {
        if (product.price == null) return false;
        const [min,max] = priceRange.split('-').map(Number);
        return product.price >= min && product.price <= max;
      })());
      return (!query || searchable.includes(query))
        && (controls.category.value === 'all' || product.category === controls.category.value)
        && (controls.brand.value === 'all' || product.brand === controls.brand.value)
        && (controls.style.value === 'all' || product.pricingClass === controls.style.value)
        && (controls.pieces.value === 'all' || product.pieceType === controls.pieces.value)
        && priceMatch
        && (controls.availability.value === 'all' || (controls.availability.value === 'available' ? product.available : !product.available));
    });
    return matches.sort((a,b) => {
      if (controls.sort.value === 'price-asc') return (a.price ?? Infinity) - (b.price ?? Infinity);
      if (controls.sort.value === 'price-desc') return (b.price ?? -1) - (a.price ?? -1);
      if (controls.sort.value === 'name') return a.name.localeCompare(b.name);
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || Number(b.available) - Number(a.available);
    });
  }

  const labels = { category:'Category', brand:'Collection', style:'Style', pieces:'Pieces', price:'Price', availability:'Availability', sort:'Sort' };
  function renderChips() {
    chips.innerHTML = Object.entries(controls).filter(([key,control]) => key !== 'search' && control.value !== 'all' && !(key === 'availability' && control.value === 'available') && !(key === 'sort' && control.value === 'newest')).map(([key,control]) => `<button type="button" data-reset-filter="${key}">${escapeHtml(labels[key])}: ${escapeHtml(control.options[control.selectedIndex].text)} ×</button>`).join('');
  }

  function card(product, eager = false) {
    const priceLabel = product.price == null ? '<small>Pricing</small><strong>Price on enquiry</strong>' : `<small>${escapeHtml(product.code)}</small><strong>${money(product.price)}</strong>`;
    return `<article class="live-product" data-product-code="${escapeHtml(product.code)}">
      <button class="live-product-open" type="button" data-open-product="${escapeHtml(product.code)}" aria-label="View ${escapeHtml(product.name)} details">
        <span class="live-product-media">${responsiveImage(product.image, product.name, { eager })}<span class="live-product-badge${product.available ? '' : ' sold'}">${product.available ? 'Available to order' : 'Currently unavailable'}</span></span>
        <span class="live-product-copy"><span class="live-product-brand">${escapeHtml(product.brand)} · ${escapeHtml(product.category)}</span><strong class="live-product-name">${escapeHtml(product.name)}</strong><span class="live-product-row"><span class="live-price">${priceLabel}</span><span class="live-view">View details ↗</span></span></span>
      </button>
      ${product.available ? `<button class="live-add-cart" type="button" data-add-cart="${escapeHtml(product.code)}">Add to cart</button>` : ''}
      <a class="live-enquire" href="${whatsapp(product, product.price == null)}" target="_blank" rel="noopener noreferrer" data-order-product="${escapeHtml(product.code)}">${product.price == null ? 'Enquire for price' : 'Order on WhatsApp'} ↗</a>
    </article>`;
  }

  function render({ preserveLimits = false } = {}) {
    const matches = filterProducts();
    if (!preserveLimits) visibleByCollection.clear();
    results.textContent = `${matches.length} design${matches.length === 1 ? '' : 's'} found`;
    const collections = matches.reduce((groups, product) => {
      const name = product.brand || product.sourceCollection || 'Other designs';
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(product);
      return groups;
    }, new Map());
    grid.innerHTML = matches.length ? [...collections].map(([name, items], collectionIndex) => {
      const visibleCount = Math.min(items.length, visibleByCollection.get(name) || initialCollectionLimit());
      const remaining = items.length - visibleCount;
      return `<section class="live-product-collection" id="${collectionId(name)}" aria-labelledby="${collectionId(name)}-title">
      <div class="live-product-collection-head">
        <div><span>Collection</span><h3 id="${collectionId(name)}-title">${escapeHtml(name)}</h3><a href="${escapeHtml(collectionPageUrl(name))}">Open ${escapeHtml(name)} collection page</a></div>
        <p>Showing ${visibleCount} of ${items.length} design${items.length === 1 ? '' : 's'}</p>
      </div>
      <div class="live-collection-products">${items.slice(0, visibleCount).map((product, productIndex) => card(product, collectionIndex === 0 && productIndex < 2)).join('')}</div>
      ${remaining > 0 ? `<button class="button button-gold live-collection-more" type="button" data-load-collection="${escapeHtml(name)}">Load more designs <small>${remaining} remaining</small></button>` : ''}
    </section>`;
    }).join('') : '<p class="live-empty">No designs match these filters. Try a different search or contact our team on WhatsApp.</p>';
    loadMore.hidden = true;
    renderChips();
  }

  function createDialog() {
    const dialog = document.createElement('dialog');
    dialog.className = 'live-product-dialog';
    dialog.setAttribute('aria-label','Product details');
    dialog.innerHTML = '<button type="button" class="live-dialog-close" aria-label="Close product details">×</button><div data-live-dialog-content></div>';
    document.body.append(dialog);
    dialog.querySelector('.live-dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    return dialog;
  }
  const dialog = createDialog();

  function openProduct(code, updateUrl = true) {
    const product = products.find(item => item.code === code);
    if (!product) return;
    const images = [...new Set([product.image, ...(product.images || [])].filter(Boolean))];
    const priceCopy = product.price == null ? '<strong>Price on enquiry</strong><small>Our automated system could not classify this design with sufficient confidence, so no estimated price is shown.</small>' : `<strong>${money(product.price)}</strong><small>Al Huma Collection retail price</small>`;
    dialog.querySelector('[data-live-dialog-content]').innerHTML = `<div class="live-dialog-layout">
      <div class="live-dialog-gallery"><div class="live-dialog-stage"><img src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}" data-dialog-main /></div><div class="live-dialog-thumbs">${images.map((image,index) => `<button type="button" data-dialog-image="${escapeHtml(image)}" class="${index === 0 ? 'active' : ''}"><img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)} view ${index+1}" loading="lazy" /></button>`).join('')}</div></div>
      <div class="live-dialog-copy"><p class="eyebrow dark"><span></span>${escapeHtml(product.brand)} · ${escapeHtml(product.category)}</p><h2>${escapeHtml(product.name)}</h2><dl><div><dt>Product code</dt><dd>${escapeHtml(product.code)}</dd></div><div><dt>Style</dt><dd>${product.pricingClass === 'embroidered' ? 'Embroidered' : product.pricingClass === 'non-embroidered' ? 'Printed / non-embroidered' : 'Classification pending'}</dd></div><div><dt>Suit type</dt><dd>${escapeHtml(product.pieceType)}</dd></div><div><dt>Availability</dt><dd>${product.available ? 'Available to order — confirmation required' : 'Currently unavailable'}</dd></div></dl><div class="live-dialog-price">${priceCopy}</div><div class="live-dialog-actions">${product.available ? `<button class="button button-dark" type="button" data-dialog-cart="${escapeHtml(product.code)}">Add to cart</button>` : ''}<a class="button button-outline-dark" href="${whatsapp(product, product.price == null)}" target="_blank" rel="noopener noreferrer" data-dialog-order>${product.price == null ? 'Enquire for price' : 'Order on WhatsApp'}</a><button class="button button-outline-dark" type="button" data-dialog-share>Share product</button></div><p class="live-dialog-note">Availability is synchronized from our approved supplier source approximately every 12 hours. Please confirm with our team before payment.</p></div>
    </div>`;
    dialog.querySelectorAll('[data-dialog-image]').forEach(button => button.addEventListener('click', () => {
      dialog.querySelector('[data-dialog-main]').src = button.dataset.dialogImage;
      dialog.querySelectorAll('[data-dialog-image]').forEach(item => item.classList.toggle('active', item === button));
    }));
    dialog.querySelector('[data-dialog-share]').addEventListener('click', async () => {
      const data = { title:product.name, text:`${product.name} — ${product.code}`, url:productUrl(product) };
      if (navigator.share) await navigator.share(data).catch(() => {}); else await navigator.clipboard.writeText(data.url);
      track('share_product',{ product_code:product.code });
    });
    dialog.querySelector('[data-dialog-order]').addEventListener('click', () => track('whatsapp_order',{ product_code:product.code, price_status:product.pricingStatus }));
    dialog.querySelector('[data-dialog-cart]')?.addEventListener('click', () => {
      dialog.close();
      window.dispatchEvent(new CustomEvent('alhuma:add-to-cart',{detail:{product}}));
    });
    if (updateUrl) history.replaceState(null,'',productUrl(product));
    dialog.showModal();
    track('view_item',{ currency:'PKR', value:product.price, items:[product], meta_event:'ViewContent', content_ids:[product.code], availability:product.available });
    addProductSchema(product);
  }

  function addProductSchema(product) {
    document.querySelector('[data-product-schema]')?.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json'; script.dataset.productSchema = '';
    script.textContent = JSON.stringify({ '@context':'https://schema.org','@type':'Product',name:product.name,sku:product.code,image:product.images?.length ? product.images : [product.image],brand:{'@type':'Brand',name:product.brand},offers:product.price == null ? undefined : {'@type':'Offer',priceCurrency:'PKR',price:product.price,availability:product.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',url:productUrl(product)} });
    document.head.append(script);
  }

  section.addEventListener('click', event => {
    const open = event.target.closest('[data-open-product]'); if (open) openProduct(open.dataset.openProduct);
    const order = event.target.closest('[data-order-product]'); if (order) track('whatsapp_order',{ product_code:order.dataset.orderProduct });
    const reset = event.target.closest('[data-reset-filter]'); if (reset) { controls[reset.dataset.resetFilter].value = 'all'; render(); }
    const add = event.target.closest('[data-add-cart]'); if (add) { const product=products.find(item=>item.code===add.dataset.addCart); if(product) window.dispatchEvent(new CustomEvent('alhuma:add-to-cart',{detail:{product}})); }
    const more = event.target.closest('[data-load-collection]');
    if (more) {
      const name = more.dataset.loadCollection;
      visibleByCollection.set(name, (visibleByCollection.get(name) || initialCollectionLimit()) + collectionBatchSize());
      render({ preserveLimits:true });
      document.getElementById(collectionId(name))?.scrollIntoView({ block:'nearest' });
      track('load_more_collection', { brand:name });
    }
  });
  Object.values(controls).forEach(control => control.addEventListener('input', () => {
    render();
    const isSearch = control.dataset.liveSearch !== undefined;
    track(isSearch && control.value.trim() ? 'search' : 'filter_catalogue', isSearch ? { search_term:control.value.trim(), result_count:filterProducts().length, meta_event:'Search' } : { filter:control.previousElementSibling?.textContent, value:control.value });
  }));
  clear.addEventListener('click', () => resetCatalogue());

  function openCollection(brand, behavior = 'smooth') {
    resetCatalogue({ brand });
    liveNav?.removeAttribute('open');
    requestAnimationFrame(() => {
      const target = document.getElementById(collectionId(brand));
      if (target) target.scrollIntoView({ behavior, block:'start' });
    });
  }

  function populateNavigation() {
    const brands = [...new Set(products.map(product => product.brand).filter(Boolean))].sort();
    controls.brand.innerHTML = '<option value="all">All collections</option>' + brands.map(brand => `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`).join('');
    const enquirySelect = document.querySelector('[data-live-enquiry-collection]');
    if (enquirySelect) {
      enquirySelect.innerHTML = '<option value="Help me choose">Help me choose</option>' + ['Formal','Luxury'].map(group => {
        const list = [...new Set(products.filter(product => product.category === group).map(product => product.brand).filter(Boolean))].sort();
        return `<optgroup label="${group} collections">${list.map(brand => `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`).join('')}</optgroup>`;
      }).join('');
    }
    if (!navGroups) return;
    navGroups.innerHTML = ['Formal','Luxury'].map(group => {
      const list = [...new Set(products.filter(product => product.category === group).map(product => product.brand))].sort();
      return `<div><strong>${group}</strong>${list.map(brand => `<a href="#${collectionId(brand)}" data-nav-brand="${escapeHtml(brand)}">${escapeHtml(brand)}</a>`).join('')}</div>`;
    }).join('');
    navGroups.addEventListener('click', event => {
      const link = event.target.closest('[data-nav-brand]');
      if (!link) return;
      event.preventDefault();
      openCollection(link.dataset.navBrand);
      track('collection_navigation_open', { brand:link.dataset.navBrand });
    });
  }

  function populateCollectionSlider() {
    if (!collectionSlider) return;
    const collections = [...new Set(products.map(product => product.brand).filter(Boolean))].map(brand => {
      const items = products.filter(product => product.brand === brand);
      const available = items.filter(product => product.available);
      const cover = (available[0] || items[0])?.image;
      const category = items.find(product => product.category)?.category || 'Collection';
      return { brand, items, available, cover, category };
    }).filter(collection => collection.cover).sort((a,b) => b.available.length - a.available.length || a.brand.localeCompare(b.brand));
    collectionSlider.innerHTML = collections.map((collection, index) => `<button type="button" class="live-collection-slide" data-slide-brand="${escapeHtml(collection.brand)}" aria-label="Open ${escapeHtml(collection.brand)} collection">
      <span class="live-collection-image">${responsiveImage(collection.cover, `${collection.brand} collection`, { width:600, eager:index < 2 })}<i>${escapeHtml(collection.category)}</i></span>
      <span class="live-collection-copy"><strong>${escapeHtml(collection.brand)}</strong><small>${collection.available.length} design${collection.available.length === 1 ? '' : 's'} available</small><b>Explore collection →</b></span>
    </button>`).join('');
    collectionSlider.addEventListener('click', event => {
      const slide = event.target.closest('[data-slide-brand]');
      if (!slide) return;
      openCollection(slide.dataset.slideBrand);
      track('collection_slider_open',{ brand:slide.dataset.slideBrand });
    });
    const scroll = direction => collectionSlider.scrollBy({ left:direction * Math.max(280, collectionSlider.clientWidth * .78), behavior:'smooth' });
    collectionShowcase?.querySelector('[data-collection-prev]')?.addEventListener('click', () => scroll(-1));
    collectionShowcase?.querySelector('[data-collection-next]')?.addEventListener('click', () => scroll(1));
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href="#live-catalogue"], a[href="#new-arrivals"]');
    if (!link || link.hasAttribute('data-nav-brand')) return;
    resetCatalogue();
    liveNav?.removeAttribute('open');
    track('catalogue_navigation_open', { source:(link.textContent || 'catalogue link').trim() });
  });

  fetch(`catalogue/dawood-products.json?v=${Date.now()}`, { cache:'no-store' })
    .then(response => { if (!response.ok) throw new Error('Catalogue is not ready'); return response.json(); })
    .then(data => {
      products = Array.isArray(data.products) ? data.products : [];
      if (!products.length) throw new Error('Catalogue is empty');
      const date = new Date(data.synchronizedAt);
      const stale = Date.now() - date.getTime() > 36 * 60 * 60 * 1000;
      const updatedLabel = date.toLocaleString('en-PK', { dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Karachi' });
      syncTime.textContent = `Catalogue last updated: ${updatedLabel} PKT${stale ? ' — next update delayed; please confirm availability' : ''}`;
      syncTime.title = `Last successful synchronization: ${date.toISOString()}`;
      syncTime.classList.toggle('stale',stale);
      populateNavigation(); populateCollectionSlider(); section.hidden=false; revealCatalogue(); render();
      window.dispatchEvent(new CustomEvent('alhuma:catalogue-ready', { detail:{ synchronizedAt:data.synchronizedAt, products:products.map(product => ({ code:product.code, name:product.name, brand:product.brand, category:product.category, available:product.available, price:product.price, pricingClass:product.pricingClass, pieceType:product.pieceType, priceLabel:product.price == null ? 'Please enquire on WhatsApp for the current price.' : `The displayed retail price is ${money(product.price)}.`, whatsapp:whatsapp(product, product.price == null) })) } }));
      const requested = new URLSearchParams(location.search).get('product'); if(requested) setTimeout(() => openProduct(requested,false),100);
      track('catalogue_loaded',{ product_count:products.length, available_count:data.counts?.available, enquiry_price_count:data.counts?.priceOnEnquiry });
    })
    .catch(() => { section.hidden=true; if(navGroups) navGroups.innerHTML='<a href="https://wa.me/923216115731">Catalogue temporarily unavailable — contact our team</a>'; });
})();
