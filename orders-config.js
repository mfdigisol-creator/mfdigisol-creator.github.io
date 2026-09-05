(() => {
  'use strict';

  // Public configuration only. Never place Worker secrets or Meta tokens here.
  // Emergency rollback: change mode from "staging" to "legacy" and publish.
  window.AL_HUMA_ORDERS_CONFIG = Object.freeze(Object.assign({
    mode: 'staging',
    endpoint: 'https://alhuma-orders-staging.alhumacollection.workers.dev/v1/orders',
    turnstileSiteKey: '0x4AAAAAAEB8ZJE2SwNUQF6I',
    turnstileAction: 'submit_order',
    consentVersion: 1,
    confirmedUrl: 'https://alhumacollection.com/order-confirmed.html',
    requestTimeoutMs: 20000,
    debug: false
  }, window.AL_HUMA_ORDERS_CONFIG || {}));
})();
