(() => {
  'use strict';

  // Public configuration only. Never place Worker secrets or Meta tokens here.
  // Emergency rollback: change mode from "production" to "legacy" and publish.
  window.AL_HUMA_ORDERS_CONFIG = Object.freeze(Object.assign({
    mode: 'production',
    endpoint: 'https://orders-api.alhumacollection.com/v1/orders',
    reviewsEndpoint: 'https://orders-api.alhumacollection.com/v1/reviews',
    turnstileSiteKey: '0x4AAAAAAEB8ZJE2SwNUQF6I',
    turnstileAction: 'submit_order',
    reviewTurnstileAction: 'submit_review',
    consentVersion: 1,
    confirmedUrl: 'https://alhumacollection.com/order-confirmed.html',
    requestTimeoutMs: 20000,
    debug: false
  }, window.AL_HUMA_ORDERS_CONFIG || {}));
})();
