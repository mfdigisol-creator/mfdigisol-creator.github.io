(() => {
  const section = document.querySelector('[data-live-catalogue]');
  if (!section) return;

  const grid = section.querySelector('[data-live-grid]');
  const search = section.querySelector('[data-live-search]');
  const category = section.querySelector('[data-live-category]');
  const availability = section.querySelector('[data-live-availability]');
  const results = section.querySelector('[data-live-results]');
  const syncTime = section.querySelector('[data-live-sync-time]');
  const loadMore = section.querySelector('[data-live-more]');
  let products = [];
  let visible = 24;

  const money = value => new Intl.NumberFormat('en-PK', { style:'currency', currency:'PKR', maximumFractionDigits:0 }).format(value).replace('PKR', 'Rs.');
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const whatsapp = product => `https://wa.me/923216115731?text=${encodeURIComponent(`Hello Al Huma Collection, I would like to order ${product.name} (${product.code}) shown at ${money(product.price)}. Please confirm availability and ordering details.`)}`;

  function filtered() {
    const query = search.value.trim().toLowerCase();
    return products.filter(product => {
      const matchesQuery = !query || `${product.name} ${product.code} ${product.brand} ${product.sourceCollection}`.toLowerCase().includes(query);
      const matchesCategory = category.value === 'all' || product.category === category.value;
      const matchesAvailability = availability.value === 'all' || (availability.value === 'available' ? product.available : !product.available);
      return matchesQuery && matchesCategory && matchesAvailability;
    });
  }

  function render() {
    const matches = filtered();
    const shown = matches.slice(0, visible);
    results.textContent = `${matches.length} design${matches.length === 1 ? '' : 's'} found`;
    grid.innerHTML = shown.length ? shown.map(product => `
      <article class="live-product">
        <div class="live-product-media">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" referrerpolicy="no-referrer" />
          <span class="live-product-badge${product.available ? '' : ' sold'}">${product.available ? 'Available' : 'Currently unavailable'}</span>
        </div>
        <div class="live-product-copy">
          <p class="live-product-brand">${escapeHtml(product.brand)} · ${escapeHtml(product.category)}</p>
          <h3>${escapeHtml(product.name)}</h3>
          <div class="live-product-row">
            <span class="live-price"><small>${escapeHtml(product.code)}</small><strong>${money(product.price)}</strong></span>
            <a class="live-enquire" href="${whatsapp(product)}" target="_blank" rel="noopener noreferrer">Order on WhatsApp ↗</a>
          </div>
        </div>
      </article>`).join('') : '<p class="live-empty">No designs match these filters. Try a different search or contact our team on WhatsApp.</p>';
    loadMore.hidden = shown.length >= matches.length;
  }

  [search, category, availability].forEach(control => control.addEventListener('input', () => { visible = 24; render(); }));
  loadMore.addEventListener('click', () => { visible += 24; render(); });

  fetch(`catalogue/dawood-products.json?v=${Date.now()}`, { cache:'no-store' })
    .then(response => { if (!response.ok) throw new Error('Catalogue is not ready'); return response.json(); })
    .then(data => {
      products = Array.isArray(data.products) ? data.products : [];
      if (!products.length) throw new Error('Catalogue is empty');
      const date = new Date(data.synchronizedAt);
      syncTime.textContent = `Updated ${date.toLocaleString('en-PK', { dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Karachi' })}`;
      section.hidden = false;
      render();
    })
    .catch(() => { section.hidden = true; });
})();
