(() => {
  'use strict';

  const config = window.AL_HUMA_ORDERS_CONFIG || {};
  const endpoint = String(config.reviewsEndpoint || '').trim();
  const siteKey = String(config.turnstileSiteKey || '').trim();
  const action = String(config.reviewTurnstileAction || '').trim();
  const timeoutMs = Math.min(60000, Math.max(5000, Number(config.requestTimeoutMs) || 20000));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  class ReviewError extends Error {
    constructor(code, message, { status = 0, requestId = '' } = {}) {
      super(message);
      this.name = 'ReviewError';
      this.code = code;
      this.status = status;
      this.requestId = requestId;
    }
  }

  function neutralizeLegacyHomepageReviews() {
    const section = document.querySelector('.customer-reviews');
    if (!section) return;
    const form = section.querySelector('.review-form');
    if (form) {
      form.removeAttribute('action');
      form.removeAttribute('method');
      form.remove();
    }
    const root = section.querySelector('[data-approved-reviews]');
    if (root) {
      root.innerHTML = '<div class="review-empty"><span>Product-specific reviews</span><h3>Reviews now belong to each design.</h3><p>Open any design in the live catalogue to read published reviews or submit your own experience. Reviews are published as submitted and are not edited by Al Huma Collection.</p></div>';
    }
    const intro = section.querySelector('.reviews-heading > p:last-child');
    if (intro) intro.textContent = 'Published customer reviews are shown against the exact design they describe. Reviews are published as submitted and are not edited by Al Huma Collection.';
  }

  neutralizeLegacyHomepageReviews();

  function endpointIsValid(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:'
        && url.hostname === 'orders-api.alhumacollection.com'
        && url.pathname === '/v1/reviews'
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
    if (!endpointIsValid(endpoint)) return 'Reviews endpoint is not configured.';
    if (!siteKeyIsValid(siteKey)) return 'Turnstile site key is not configured.';
    if (action !== 'submit_review') return 'Reviews Turnstile action is not configured.';
    return '';
  }

  function productCodeFromDialog(dialog) {
    const rows = [...dialog.querySelectorAll('.live-dialog-copy dl > div')];
    const row = rows.find(item => item.querySelector('dt')?.textContent.trim().toLowerCase() === 'product code');
    return row?.querySelector('dd')?.textContent.trim() || '';
  }

  function stars(rating) {
    const bounded = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return `${'★'.repeat(bounded)}${'☆'.repeat(5 - bounded)}`;
  }

  function renderApprovedReviews(root, body) {
    const reviews = Array.isArray(body?.reviews) ? body.reviews : [];
    const count = Number(body?.review_count || 0);
    const average = body?.average_rating == null ? null : Number(body.average_rating);
    const summary = root.querySelector('[data-review-summary]');
    const list = root.querySelector('[data-product-approved-reviews]');

    if (summary) {
      summary.innerHTML = count && Number.isFinite(average)
        ? `<strong>${average.toFixed(1)} / 5</strong><span>${count} published review${count === 1 ? '' : 's'}</span>`
        : '<strong>No reviews yet</strong><span>Be the first to share a genuine product experience.</span>';
    }
    if (!list) return;
    list.innerHTML = reviews.length ? reviews.map(review => {
      const rating = Math.max(1, Math.min(5, Math.round(Number(review.rating) || 0)));
      const date = review.created_at ? new Date(review.created_at) : null;
      const dateText = date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })
        : '';
      return `<article class="review-card"><div class="review-stars" aria-label="${rating} out of 5 stars">${stars(rating)}</div><blockquote>“${escapeHtml(review.review_text)}”</blockquote><p><strong>${escapeHtml(review.display_name)}</strong>${dateText ? `<span>${escapeHtml(dateText)}</span>` : ''}</p></article>`;
    }).join('') : '<div class="review-empty"><span>Customer reviews</span><h3>No reviews for this design yet.</h3><p>Your review is published as submitted after security verification. Al Huma Collection does not edit customer ratings or review text. Spam, abusive, unrelated or fraudulent content may be removed.</p></div>';
  }

  async function responseJson(response) {
    try {
      return await response.json();
    } catch {
      throw new ReviewError('INVALID_RESPONSE', 'The review service returned an invalid response.', { status: response.status });
    }
  }

  async function loadApprovedReviews(productId, root) {
    const list = root.querySelector('[data-product-approved-reviews]');
    if (list) list.innerHTML = '<div class="review-empty"><p>Loading published reviews…</p></div>';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = new URL(endpoint);
      url.searchParams.set('product_id', productId);
      url.searchParams.set('limit', '20');
      const response = await fetch(url.href, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      const body = await responseJson(response);
      if (!response.ok || body?.success !== true || body?.product_id !== productId || !Array.isArray(body?.reviews)) {
        throw new ReviewError(String(body?.code || 'REVIEWS_UNAVAILABLE'), String(body?.message || 'Published reviews could not be loaded.'), {
          status: response.status,
          requestId: String(body?.request_id || '')
        });
      }
      renderApprovedReviews(root, body);
    } catch (error) {
      if (!root.isConnected) return;
      const message = error?.name === 'AbortError'
        ? 'Published reviews took too long to load. You can still submit a review below.'
        : 'Published reviews are temporarily unavailable. You can still submit a review below.';
      if (list) list.innerHTML = `<div class="review-empty"><h3>Reviews could not be loaded.</h3><p>${escapeHtml(message)}</p></div>`;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  let turnstilePromise = null;
  let activeTurnstileWidgetId = null;

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (turnstilePromise) return turnstilePromise;
    turnstilePromise = new Promise((resolve, reject) => {
      const existing = document.getElementById('alhuma-turnstile-api');
      const script = existing || document.createElement('script');
      const loaded = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable'));
      script.addEventListener('load', loaded, { once: true });
      script.addEventListener('error', () => reject(new Error('Turnstile failed to load')), { once: true });
      if (!existing) {
        script.id = 'alhuma-turnstile-api';
        script.async = true;
        script.defer = true;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        document.head.append(script);
      } else {
        window.setTimeout(() => {
          if (window.turnstile) resolve(window.turnstile);
        }, 0);
      }
    });
    return turnstilePromise;
  }

  function removeActiveTurnstile() {
    if (activeTurnstileWidgetId === null || !window.turnstile) return;
    try { window.turnstile.remove(activeTurnstileWidgetId); } catch {}
    activeTurnstileWidgetId = null;
  }

  function errorMessage(error) {
    const messages = {
      RATE_LIMITED: 'Too many review attempts were made. Please wait one minute and try again.',
      BOT_CHECK_FAILED: 'Security verification failed. Please complete it again.',
      BOT_CHECK_REQUIRED: 'Please complete the security verification before submitting your review.',
      BOT_CHECK_HOSTNAME_FAILED: 'Security verification failed. Please reload the page and try again.',
      BOT_CHECK_ACTION_FAILED: 'Security verification failed. Please reload the page and try again.',
      BOT_CHECK_UNAVAILABLE: 'Security verification is temporarily unavailable. Please try again shortly.',
      PRODUCT_NOT_FOUND: 'This design is not currently available in the active catalogue for review submission.',
      VALIDATION_FAILED: 'Please review your rating, display name and review text, then try again.',
      IDEMPOTENCY_CONFLICT: 'The previous submission state changed. Please complete security verification and retry once.',
      INVALID_RESPONSE: 'The review service returned an unexpected response. Please retry once.',
      REQUEST_TIMEOUT: 'The review service response was delayed. Please complete security verification and retry once.',
      NETWORK_ERROR: 'The review service could not be reached. Please complete security verification and retry once.'
    };
    const reference = error?.requestId ? ` Reference: ${error.requestId}` : '';
    return `${messages[error?.code] || 'Your review could not be submitted. Please try again shortly.'}${reference}`;
  }

  function mountProductReviews(dialog) {
    const productId = productCodeFromDialog(dialog);
    const copy = dialog.querySelector('.live-dialog-copy');
    if (!productId || !copy) return;
    const existing = copy.querySelector('[data-product-reviews]');
    if (existing?.dataset.productId === productId) return;
    if (existing) existing.remove();
    removeActiveTurnstile();

    const instanceId = `review-${crypto.randomUUID()}`;
    const root = document.createElement('section');
    root.className = 'product-reviews-panel';
    root.dataset.productReviews = '';
    root.dataset.productId = productId;
    root.setAttribute('aria-labelledby', `${instanceId}-title`);
    root.innerHTML = `
      <div class="product-reviews-head">
        <div><span>Customer reviews</span><h3 id="${instanceId}-title">Reviews for this design</h3></div>
        <p data-review-summary><strong>Loading…</strong><span>Checking published reviews.</span></p>
      </div>
      <div class="approved-reviews product-approved-reviews" data-product-approved-reviews aria-live="polite"></div>
      <form class="review-form product-review-form" data-product-review-form novalidate>
        <div class="review-form-head"><div><span>Share your experience</span><h3>Leave a review</h3></div><p>Your review is linked to product code <strong>${escapeHtml(productId)}</strong> and is published as submitted after security verification. Al Huma Collection does not edit customer ratings or review text. Spam, abusive, unrelated or fraudulent content may be removed.</p></div>
        <fieldset><legend>Rating</legend><div class="rating-input">
          <input id="${instanceId}-rate5" type="radio" name="rating" value="5" required><label for="${instanceId}-rate5" title="5 stars">★</label>
          <input id="${instanceId}-rate4" type="radio" name="rating" value="4"><label for="${instanceId}-rate4" title="4 stars">★</label>
          <input id="${instanceId}-rate3" type="radio" name="rating" value="3"><label for="${instanceId}-rate3" title="3 stars">★</label>
          <input id="${instanceId}-rate2" type="radio" name="rating" value="2"><label for="${instanceId}-rate2" title="2 stars">★</label>
          <input id="${instanceId}-rate1" type="radio" name="rating" value="1"><label for="${instanceId}-rate1" title="1 star">★</label>
        </div></fieldset>
        <label>Display name<input name="display_name" required minlength="2" maxlength="60" autocomplete="name" placeholder="Your first name or preferred public name"></label>
        <label class="review-wide">Your review<textarea name="review_text" required minlength="10" maxlength="1000" rows="5" placeholder="Tell us about this product or your experience with it."></textarea></label>
        <div class="review-wide review-security"><strong>Security verification</strong><div data-review-turnstile></div><small>This check helps prevent automated and duplicate review submissions.</small></div>
        <p class="review-wide review-status" data-review-status role="status" aria-live="polite"></p>
        <button class="button button-dark review-wide" type="submit" disabled>Publish review</button>
      </form>`;
    copy.append(root);

    const problem = configurationError();
    const form = root.querySelector('[data-product-review-form]');
    const status = root.querySelector('[data-review-status]');
    const submit = form.querySelector('button[type="submit"]');
    const turnstileContainer = root.querySelector('[data-review-turnstile]');
    let turnstileToken = '';
    let attempt = null;
    let submitting = false;

    const setStatus = (message = '', type = '') => {
      status.textContent = message;
      status.dataset.status = type;
    };

    const attemptKey = payload => {
      const fingerprint = JSON.stringify({
        product_id: payload.product_id,
        rating: payload.rating,
        display_name: payload.display_name,
        review_text: payload.review_text
      });
      if (!attempt || attempt.fingerprint !== fingerprint) {
        attempt = { fingerprint, key: crypto.randomUUID() };
      }
      return attempt.key;
    };

    const resetSecurity = () => {
      turnstileToken = '';
      submit.disabled = true;
      if (activeTurnstileWidgetId !== null && window.turnstile) {
        try { window.turnstile.reset(activeTurnstileWidgetId); } catch {}
      }
    };

    const prepareTurnstile = async () => {
      if (problem) {
        setStatus(problem, 'error');
        return;
      }
      setStatus('Loading security verification…', 'info');
      try {
        const turnstile = await loadTurnstile();
        if (!root.isConnected || root.dataset.productId !== productId) return;
        removeActiveTurnstile();
        activeTurnstileWidgetId = turnstile.render(turnstileContainer, {
          sitekey: siteKey,
          action,
          theme: 'light',
          appearance: 'always',
          callback: token => {
            turnstileToken = token;
            setStatus('Security verification complete.', 'success');
            submit.disabled = false;
          },
          'expired-callback': () => {
            turnstileToken = '';
            submit.disabled = true;
            setStatus('Security verification expired. Please complete it again.', 'error');
          },
          'error-callback': () => {
            turnstileToken = '';
            submit.disabled = true;
            setStatus('Security verification could not complete. Please try again.', 'error');
          }
        });
      } catch {
        setStatus('Security verification is temporarily unavailable. Please try again shortly.', 'error');
        submit.disabled = true;
      }
    };

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submitting) return;
      if (!form.reportValidity()) return;
      if (!turnstileToken) {
        setStatus('Please complete the security verification before submitting your review.', 'error');
        return;
      }
      const rating = Number(new FormData(form).get('rating'));
      const displayName = String(form.elements.display_name.value || '').trim();
      const reviewText = String(form.elements.review_text.value || '').trim();
      const payload = {
        product_id: productId,
        rating,
        display_name: displayName,
        review_text: reviewText,
        turnstile_token: turnstileToken
      };
      payload.idempotency_key = attemptKey(payload);

      submitting = true;
      submit.disabled = true;
      submit.textContent = 'Publishing review…';
      setStatus('Submitting your review securely. Please do not click again.', 'info');
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'omit',
          cache: 'no-store',
          signal: controller.signal
        });
        const body = await responseJson(response);
        if (!response.ok || body?.success !== true || !body?.review_id || !body?.status) {
          throw new ReviewError(String(body?.code || 'REVIEW_REJECTED'), String(body?.message || 'The review could not be submitted.'), {
            status: response.status,
            requestId: String(body?.request_id || '')
          });
        }
        attempt = null;
        form.reset();
        const published = body.status === 'approved';
        setStatus(published
          ? (body.idempotent ? 'Your review was already published as submitted.' : 'Thank you. Your review has been published as submitted.')
          : body.status === 'pending'
            ? 'Your earlier review was received before immediate publishing was enabled and is still awaiting moderation.'
            : 'Your earlier review is not currently published.', published ? 'success' : 'info');
        resetSecurity();
        if (published) await loadApprovedReviews(productId, root);
      } catch (error) {
        const normalized = error instanceof ReviewError
          ? error
          : error?.name === 'AbortError'
            ? new ReviewError('REQUEST_TIMEOUT', 'The request timed out.')
            : new ReviewError('NETWORK_ERROR', 'The review service could not be reached.');
        if (normalized.code === 'IDEMPOTENCY_CONFLICT') attempt = null;
        setStatus(errorMessage(normalized), 'error');
        resetSecurity();
      } finally {
        window.clearTimeout(timeout);
        submitting = false;
        submit.textContent = 'Publish review';
      }
    });

    if (problem) {
      root.querySelector('[data-product-approved-reviews]').innerHTML = '<div class="review-empty"><h3>Reviews are temporarily unavailable.</h3><p>The storefront Reviews configuration is incomplete.</p></div>';
      setStatus(problem, 'error');
    } else {
      loadApprovedReviews(productId, root);
      prepareTurnstile();
    }
  }

  const dialog = document.querySelector('.live-product-dialog');
  const content = dialog?.querySelector('[data-live-dialog-content]');
  if (!dialog || !content) return;

  const observer = new MutationObserver(() => mountProductReviews(dialog));
  observer.observe(content, { childList: true });
  dialog.addEventListener('close', removeActiveTurnstile);
  mountProductReviews(dialog);
})();
