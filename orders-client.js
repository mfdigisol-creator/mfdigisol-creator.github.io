(() => {
  'use strict';

  const config = Object.assign({
    mode: 'legacy',
    endpoint: '',
    turnstileSiteKey: '',
    turnstileAction: 'submit_order',
    consentVersion: 1,
    confirmedUrl: '/order-confirmed.html',
    requestTimeoutMs: 20000,
    debug: false
  }, window.AL_HUMA_ORDERS_CONFIG || {});

  class OrderSubmissionError extends Error {
    constructor(code, message, { status = 0, requestId = '' } = {}) {
      super(message);
      this.name = 'OrderSubmissionError';
      this.code = code;
      this.status = status;
      this.requestId = requestId;
    }
  }

  function endpointIsValid(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:'
        && url.pathname === '/v1/orders'
        && !url.username
        && !url.password
        && !url.search
        && !url.hash;
    } catch {
      return false;
    }
  }

  function siteKeyIsValid(value) {
    return typeof value === 'string'
      && value.length >= 20
      && !value.startsWith('SET_')
      && !value.includes('REPLACE');
  }

  function configurationError() {
    if (!['legacy', 'staging'].includes(config.mode)) return 'Invalid order mode';
    if (config.mode === 'legacy') return '';
    if (!endpointIsValid(config.endpoint)) return 'Invalid staging order endpoint';
    if (!siteKeyIsValid(config.turnstileSiteKey)) return 'Turnstile site key is not configured';
    if (!Number.isInteger(config.consentVersion) || config.consentVersion < 1) return 'Invalid consent version';
    return '';
  }

  function cookie(name) {
    return document.cookie
      .split(';')
      .map(value => value.trim())
      .find(value => value.startsWith(`${name}=`))
      ?.slice(name.length + 1) || '';
  }

  function browserIdentifiers(marketingConsent) {
    if (!marketingConsent) return {};
    const fbp = cookie('_fbp');
    const storedFbc = cookie('_fbc');
    const fbclid = new URLSearchParams(location.search).get('fbclid');
    const fbc = storedFbc || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : '');
    return {
      ...(fbp ? { fbp } : {}),
      ...(fbc ? { fbc } : {})
    };
  }

  function normalizeItems(cart) {
    if (!Array.isArray(cart) || !cart.length) {
      throw new OrderSubmissionError('EMPTY_CART', 'Your cart is empty.');
    }
    if (cart.length > 20) {
      throw new OrderSubmissionError('INVALID_CART', 'A maximum of 20 different products is allowed per order.');
    }
    const items = cart.map(item => ({
      product_id: String(item.code || '').trim(),
      quantity: Number(item.qty)
    }));
    if (items.some(item => !item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
      throw new OrderSubmissionError('INVALID_CART', 'One or more cart items are invalid.');
    }
    return items;
  }

  function prepareOrder({ customer, cart, turnstileToken, marketingConsent }) {
    if (!String(turnstileToken || '').trim()) {
      throw new OrderSubmissionError('BOT_CHECK_REQUIRED', 'Security verification is required.');
    }
    const consent = Boolean(marketingConsent);
    return {
      turnstile_token: String(turnstileToken).trim(),
      customer: {
        name: String(customer.name || '').trim(),
        mobile: String(customer.mobile || '').trim(),
        email: String(customer.email || '').trim(),
        city_type: customer.cityType,
        city: String(customer.city || '').trim(),
        address: String(customer.address || '').trim(),
        notes: String(customer.notes || '').trim()
      },
      items: normalizeItems(cart),
      measurement: {
        marketing_consent: consent,
        consent_version: config.consentVersion,
        source_url: location.href,
        ...browserIdentifiers(consent)
      }
    };
  }

  function attemptFingerprint(payload) {
    return JSON.stringify({
      customer: payload.customer,
      items: payload.items,
      measurement: {
        marketing_consent: payload.measurement.marketing_consent,
        consent_version: payload.measurement.consent_version,
        source_url: payload.measurement.source_url
      }
    });
  }

  let lastAttempt = null;
  function idempotencyKey(payload) {
    const fingerprint = attemptFingerprint(payload);
    if (!lastAttempt || lastAttempt.fingerprint !== fingerprint) {
      lastAttempt = { fingerprint, key: crypto.randomUUID() };
    }
    return lastAttempt.key;
  }

  function resetAttempt() {
    lastAttempt = null;
  }

  async function responseJson(response) {
    try {
      return await response.json();
    } catch {
      throw new OrderSubmissionError('INVALID_RESPONSE', 'The order service returned an invalid response.', {
        status: response.status
      });
    }
  }

  async function submitOrder(input) {
    const problem = configurationError();
    if (problem) throw new OrderSubmissionError('CONFIGURATION_ERROR', problem);
    if (config.mode !== 'staging') {
      throw new OrderSubmissionError('LEGACY_MODE', 'The secure order service is not active.');
    }

    const payload = prepareOrder(input);
    payload.idempotency_key = idempotencyKey(payload);
    const controller = new AbortController();
    const timeoutMs = Math.min(60000, Math.max(5000, Number(config.requestTimeoutMs) || 20000));
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      const body = await responseJson(response);
      if (!response.ok || body?.success !== true) {
        throw new OrderSubmissionError(
          String(body?.code || 'ORDER_REJECTED'),
          String(body?.message || 'The order could not be submitted.'),
          { status: response.status, requestId: String(body?.request_id || '') }
        );
      }
      if (!body.order_id || body.status !== 'pending' || !Number.isInteger(body.estimated_total_minor)) {
        throw new OrderSubmissionError('INVALID_RESPONSE', 'The order service returned an incomplete response.', {
          status: response.status,
          requestId: String(body?.request_id || '')
        });
      }
      return body;
    } catch (error) {
      if (error instanceof OrderSubmissionError) throw error;
      if (error?.name === 'AbortError') {
        throw new OrderSubmissionError('REQUEST_TIMEOUT', 'The request timed out. Please retry once.');
      }
      if (config.debug) console.warn('[Al Huma orders]', error);
      throw new OrderSubmissionError('NETWORK_ERROR', 'The secure order service could not be reached. Please retry once.');
    } finally {
      window.clearTimeout(timeout);
    }
  }

  window.AlHumaOrdersClient = Object.freeze({
    config: Object.freeze(config),
    mode: config.mode,
    isReady: configurationError() === '',
    configurationError,
    prepareOrder,
    submitOrder,
    resetAttempt,
    OrderSubmissionError
  });
})();
