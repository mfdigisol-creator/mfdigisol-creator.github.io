(() => {
  'use strict';

  const CART_KEY = 'alhuma-cart-v1';
  const LEGACY_ENDPOINT = 'https://formsubmit.co/alhumacollection@gmail.com';
  const rawMode = window.AL_HUMA_ORDERS_CONFIG?.mode || 'legacy';
  const ordersClient = window.AlHumaOrdersClient;
  const stagingMode = rawMode === 'staging';
  const legacyMode = rawMode === 'legacy';
  const money = value => value == null ? 'Price on enquiry' : `Rs. ${Number(value).toLocaleString('en-PK')}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const track = (event, detail = {}) => window.AlHumaAnalytics?.track(event, detail);
  let cart;
  try {
    const stored = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    cart = Array.isArray(stored) ? stored : [];
  } catch {
    cart = [];
  }

  document.body.insertAdjacentHTML('beforeend', `
    <button class="cart-launcher" type="button" aria-label="Open shopping cart">Cart <b data-cart-count>0</b></button>
    <aside class="cart-drawer" aria-label="Shopping cart">
      <div class="cart-head"><h2>Your cart</h2><button class="cart-close" type="button" aria-label="Close cart">×</button></div>
      <div class="cart-items"></div><div class="cart-summary"></div>
    </aside>
    <dialog class="checkout-dialog">
      <button class="checkout-close" type="button" aria-label="Close checkout">×</button>
      <div class="checkout-wrap">
        <h2>Complete your order</h2>
        <p>Cash on Delivery throughout Pakistan. Our team will call to confirm availability and delivery charges.</p>
        <form class="checkout-form" method="POST">
          <input type="hidden" name="_subject" value="New COD order — Al Huma Collection">
          <input type="hidden" name="_captcha" value="true">
          <input type="hidden" name="_next" value="https://alhumacollection.com/order-confirmed.html">
          <input type="hidden" name="Order details"><input type="hidden" name="Order total"><input type="hidden" name="Order ID">
          <label>Full name<input name="Customer name" required minlength="2" maxlength="120" autocomplete="name"></label>
          <label>Mobile number<input name="Mobile" required inputmode="tel" maxlength="13" pattern="(?:\\+92|0)?3[0-9]{9}" placeholder="03XXXXXXXXX"></label>
          <label>Email (optional)<input name="Customer email" type="email" maxlength="254" autocomplete="email"></label>
          <label>City<select name="City" required><option value="">Select</option><option>Sialkot</option><option value="Outside Sialkot">Other city in Pakistan</option></select></label>
          <label class="wide" data-other-city hidden>City name<input name="Other city" minlength="2" maxlength="100"></label>
          <label class="wide">Complete delivery address<textarea name="Address" rows="3" minlength="8" maxlength="500" required></textarea></label>
          <label class="wide">Order notes (optional)<textarea name="Notes" rows="2" maxlength="500"></textarea></label>
          <div class="checkout-total"></div>
          <label class="wide checkout-note">
            <span><input name="COD agreement" type="checkbox" required> I agree to Cash on Delivery. Rs. 300 applies within Sialkot and Rs. 600 outside Sialkot for parcels up to 1 kg. Charges may increase according to weight or volume and will be communicated during the confirmation call. Delivery will normally be through TCS or Leopards Courier. The estimated delivery TAT is up to 7 days after confirmation and may vary due to unforeseen circumstances. To cancel before the confirmation call, I can WhatsApp the official number with my order details.</span>
          </label>
          <label class="wide checkout-note checkout-measurement" data-order-measurement hidden>
            <span><input name="Measurement consent" type="checkbox"> Optional: I allow Al Huma Collection to use limited browser identifiers from this order to measure advertising results. This does not affect whether my order can be placed.</span>
          </label>
          <div class="wide checkout-security" data-order-security hidden>
            <strong>Security verification</strong><div data-turnstile-widget></div>
            <small>Verification helps us prevent automated and duplicate orders.</small>
          </div>
          <p class="wide checkout-status" data-order-status role="status" aria-live="polite"></p>
          <button class="checkout-submit" type="submit">Place COD order</button>
        </form>
      </div>
    </dialog>
    <div class="cart-toast" role="status"></div>
  `);

  const header = document.querySelector('[data-header]');
  const launcher = document.querySelector('.cart-launcher');
  if (header && launcher) header.insertBefore(launcher, header.querySelector('[data-menu-toggle]'));

  const drawer = document.querySelector('.cart-drawer');
  const dialog = document.querySelector('.checkout-dialog');
  const items = document.querySelector('.cart-items');
  const summary = document.querySelector('.cart-summary');
  const count = document.querySelector('[data-cart-count]');
  const form = document.querySelector('.checkout-form');
  const toast = document.querySelector('.cart-toast');
  const submitButton = form.querySelector('.checkout-submit');
  const status = form.querySelector('[data-order-status]');
  const measurement = form.querySelector('[data-order-measurement]');
  const security = form.querySelector('[data-order-security]');
  const turnstileContainer = form.querySelector('[data-turnstile-widget]');
  const city = form.elements.City;
  const otherCity = document.querySelector('[data-other-city]');
  let turnstileToken = '';
  let turnstileWidgetId = null;
  let turnstilePromise = null;
  let submitting = false;

  const totals = () => ({
    known: cart.reduce((sum, item) => sum + (item.price || 0) * item.qty, 0),
    unknown: cart.some(item => item.price == null)
  });

  function render() {
    count.textContent = cart.reduce((sum, item) => sum + item.qty, 0);
    items.innerHTML = cart.length ? cart.map(item => `
      <div class="cart-item">
        <img src="${escapeHtml(item.image)}" alt="">
        <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.code)} · ${money(item.price)}</small><button class="cart-remove" type="button" data-remove="${escapeHtml(item.code)}">Remove</button></div>
        <div class="cart-qty"><button type="button" data-qty="${escapeHtml(item.code)}" data-delta="-1">−</button><span>${item.qty}</span><button type="button" data-qty="${escapeHtml(item.code)}" data-delta="1">+</button></div>
      </div>
    `).join('') : '<p>Your cart is empty.</p>';
    const total = totals();
    summary.innerHTML = `<p><span>Products subtotal</span><strong>${money(total.known)}${total.unknown ? ' + enquiry items' : ''}</strong></p><small>Delivery at checkout: Rs. 300 within Sialkot or Rs. 600 elsewhere in Pakistan, normally for parcels up to 1 kg.</small><button class="cart-checkout" type="button" ${cart.length ? '' : 'disabled'}>Proceed to checkout</button>`;
  }

  function save() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    render();
  }

  function notify(message) {
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function setStatus(message = '', type = '') {
    status.textContent = message;
    status.dataset.status = type;
  }

  function openCart() {
    drawer.classList.add('open');
    document.body.classList.add('cart-open');
    document.querySelector('.cart-close').focus();
  }

  function closeCart() {
    drawer.classList.remove('open');
    document.body.classList.remove('cart-open');
  }

  function updateCheckout() {
    const delivery = city.value === 'Sialkot' ? 300 : 600;
    const total = totals();
    form.querySelector('.checkout-total').innerHTML = `
      <p><span>Products subtotal</span><b>${money(total.known)}${total.unknown ? ' + price-on-enquiry items' : ''}</b></p>
      <p><span>Estimated delivery</span><b>${money(delivery)}</b></p>
      <p><span>Estimated COD total</span><strong>${money(total.known + delivery)}${total.unknown ? ' + enquiry items' : ''}</strong></p>
      <small>Final total is subject to availability and parcel weight/volume confirmation.</small>`;
  }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (turnstilePromise) return turnstilePromise;
    turnstilePromise = new Promise((resolve, reject) => {
      const existing = document.getElementById('alhuma-turnstile-api');
      const script = existing || document.createElement('script');
      script.addEventListener('load', () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable')), { once: true });
      script.addEventListener('error', () => reject(new Error('Turnstile failed to load')), { once: true });
      if (!existing) {
        script.id = 'alhuma-turnstile-api';
        script.async = true;
        script.defer = true;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        document.head.append(script);
      }
    });
    return turnstilePromise;
  }

  async function ensureTurnstile() {
    if (!stagingMode || turnstileWidgetId !== null) return;
    const problem = !ordersClient ? 'Secure ordering code is unavailable.' : ordersClient.configurationError();
    if (problem) {
      setStatus('Secure checkout configuration is incomplete. Please contact us on WhatsApp.', 'error');
      submitButton.disabled = true;
      return;
    }
    setStatus('Loading security verification…', 'info');
    try {
      const turnstile = await loadTurnstile();
      turnstileWidgetId = turnstile.render(turnstileContainer, {
        sitekey: ordersClient.config.turnstileSiteKey,
        action: ordersClient.config.turnstileAction,
        theme: 'light',
        appearance: 'always',
        callback: token => {
          turnstileToken = token;
          setStatus('Security verification complete.', 'success');
          submitButton.disabled = false;
        },
        'expired-callback': () => {
          turnstileToken = '';
          setStatus('Security verification expired. Please complete it again.', 'error');
          submitButton.disabled = true;
        },
        'error-callback': () => {
          turnstileToken = '';
          setStatus('Security verification could not complete. Please try again.', 'error');
          submitButton.disabled = true;
        }
      });
    } catch {
      setStatus('Security verification is temporarily unavailable. Please try again shortly.', 'error');
      submitButton.disabled = true;
    }
  }

  function resetTurnstile() {
    turnstileToken = '';
    if (turnstileWidgetId !== null && window.turnstile) window.turnstile.reset(turnstileWidgetId);
    submitButton.disabled = true;
  }

  function prepareLegacySubmission() {
    const id = `AH-${Date.now().toString().slice(-8)}`;
    const delivery = city.value === 'Sialkot' ? 300 : 600;
    const total = totals();
    const lines = cart.map(item => `${item.qty} x ${item.name} (${item.code}) — ${money(item.price)} each`).join('\n');
    track('generate_lead', {
      currency: 'PKR', value: total.known + delivery, items: cart, order_id: id,
      lead_type: 'cod_order_submitted', meta_event: 'Lead', content_ids: cart.map(item => item.code)
    });
    form.elements['Order ID'].value = id;
    form.elements['Order details'].value = lines;
    form.elements['Order total'].value = `Products: ${money(total.known)}${total.unknown ? ' plus enquiry items' : ''}; Delivery estimate: ${money(delivery)}; Estimated total: ${money(total.known + delivery)}. Final confirmation required.`;
  }

  function customerInput() {
    const outsideSialkot = city.value === 'Outside Sialkot';
    return {
      name: form.elements['Customer name'].value,
      mobile: form.elements.Mobile.value,
      email: form.elements['Customer email'].value,
      cityType: outsideSialkot ? 'other_pakistan' : 'sialkot',
      city: outsideSialkot ? form.elements['Other city'].value : 'Sialkot',
      address: form.elements.Address.value,
      notes: form.elements.Notes.value
    };
  }

  function customerError(error) {
    const messages = {
      PRODUCT_UNAVAILABLE: 'One or more selected products are no longer available. Please review your cart or contact us on WhatsApp.',
      RATE_LIMITED: 'Too many order attempts were made. Please wait one minute and try again.',
      BOT_CHECK_FAILED: 'Security verification failed. Please complete it again.',
      BOT_CHECK_REQUIRED: 'Please complete the security verification before placing your order.',
      BOT_CHECK_HOSTNAME_FAILED: 'Security verification failed. Please reload the page and try again.',
      BOT_CHECK_ACTION_FAILED: 'Security verification failed. Please reload the page and try again.',
      BOT_CHECK_UNAVAILABLE: 'Security verification is temporarily unavailable. Please try again shortly.',
      CATALOGUE_NOT_READY: 'Ordering is temporarily unavailable while the catalogue updates. Please try again shortly.',
      REQUEST_TIMEOUT: 'The response was delayed. Please retry once; duplicate protection will keep one order.',
      NETWORK_ERROR: 'The secure order service could not be reached. Please retry once; duplicate protection will keep one order.',
      CONFIGURATION_ERROR: 'Secure checkout configuration is incomplete. Please contact us on WhatsApp.',
      VALIDATION_FAILED: 'Please review your details and try again.',
      INVALID_CART: 'One or more cart items are invalid. Please review your cart.',
      EMPTY_CART: 'Your cart is empty.'
    };
    const reference = error.requestId ? ` Reference: ${error.requestId}` : '';
    return `${messages[error.code] || 'Your order could not be submitted. Please try again or contact us on WhatsApp.'}${reference}`;
  }

  async function submitStaging(event) {
    event.preventDefault();
    if (submitting) return;
    if (!cart.length) {
      setStatus('Your cart is empty.', 'error');
      return;
    }
    if (!form.reportValidity()) return;
    if (!turnstileToken) {
      setStatus('Please complete the security verification before placing your order.', 'error');
      return;
    }

    submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting order…';
    setStatus('Submitting your secure order. Please do not click again.', 'info');
    const marketingConsent = form.elements['Measurement consent'].checked;

    try {
      const result = await ordersClient.submitOrder({
        customer: customerInput(),
        cart,
        turnstileToken,
        marketingConsent
      });
      track('generate_lead', {
        currency: 'PKR', value: result.estimated_total_minor / 100, items: cart,
        order_id: result.order_id, lead_type: 'cod_order_registered',
        meta_event: marketingConsent ? 'Lead' : undefined,
        content_ids: cart.map(item => item.code)
      });
      setStatus('Order registered successfully. Opening your confirmation page…', 'success');
      window.location.assign(ordersClient.config.confirmedUrl);
    } catch (error) {
      if (error.code === 'IDEMPOTENCY_CONFLICT') ordersClient.resetAttempt();
      resetTurnstile();
      setStatus(customerError(error), 'error');
    } finally {
      submitting = false;
      submitButton.textContent = 'Place COD order';
    }
  }

  window.addEventListener('alhuma:add-to-cart', event => {
    const product = event.detail.product;
    const existing = cart.find(item => item.code === product.code);
    if (existing && existing.qty >= 20) {
      notify('The maximum quantity for one product is 20.');
      return;
    }
    if (!existing && cart.length >= 20) {
      notify('A maximum of 20 different products is allowed per order.');
      return;
    }
    if (existing) existing.qty += 1;
    else cart.push({ code: product.code, name: product.name, price: product.price, image: product.image, qty: 1 });
    save();
    track('add_to_cart', { currency: 'PKR', value: Number(product.price) || undefined, items: [product], meta_event: 'AddToCart', content_ids: [product.code] });
    notify(`${product.name} added to cart`);
    openCart();
  });

  launcher.onclick = openCart;
  document.querySelector('.cart-close').onclick = closeCart;
  document.querySelector('.checkout-close').onclick = () => dialog.close();
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drawer.classList.contains('open')) closeCart();
  });

  items.onclick = event => {
    const quantity = event.target.closest('[data-qty]');
    const remove = event.target.closest('[data-remove]');
    if (quantity) {
      const item = cart.find(entry => entry.code === quantity.dataset.qty);
      if (!item) return;
      const nextQuantity = item.qty + Number(quantity.dataset.delta);
      if (nextQuantity > 20) {
        notify('The maximum quantity for one product is 20.');
        return;
      }
      item.qty = nextQuantity;
      if (item.qty < 1) cart = cart.filter(entry => entry !== item);
      save();
    }
    if (remove) {
      cart = cart.filter(entry => entry.code !== remove.dataset.remove);
      save();
    }
  };

  summary.onclick = event => {
    if (!event.target.closest('.cart-checkout')) return;
    const total = totals();
    track('begin_checkout', { currency: 'PKR', value: total.known, items: cart, meta_event: 'InitiateCheckout', content_ids: cart.map(item => item.code) });
    closeCart();
    updateCheckout();
    setStatus();
    dialog.showModal();
    if (stagingMode) ensureTurnstile();
  };

  city.onchange = () => {
    otherCity.hidden = city.value !== 'Outside Sialkot';
    otherCity.querySelector('input').required = !otherCity.hidden;
    updateCheckout();
  };

  if (stagingMode) {
    measurement.hidden = false;
    security.hidden = false;
    submitButton.disabled = true;
    form.addEventListener('submit', submitStaging);
  } else if (legacyMode) {
    form.action = LEGACY_ENDPOINT;
    form.addEventListener('submit', event => {
      if (!cart.length) {
        event.preventDefault();
        return;
      }
      prepareLegacySubmission();
    });
  } else {
    security.hidden = false;
    submitButton.disabled = true;
    setStatus('Secure checkout configuration is invalid. Please contact us on WhatsApp.', 'error');
    form.addEventListener('submit', event => event.preventDefault());
  }

  render();
})();
