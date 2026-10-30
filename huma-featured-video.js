/* Isolated click-to-play widescreen presentation; no Shorts, orders or social changes. */
(() => {
  'use strict';
  const root = document.querySelector('[data-huma-featured]');
  if (!root) return;
  const frame = root.querySelector('[data-huma-featured-frame]');
  const button = root.querySelector('[data-huma-featured-play]');
  const poster = root.querySelector('[data-huma-featured-poster]');
  if (!frame || !button) return;
  const id = 'NfXIKX68l8M';
  if (poster) {
    poster.addEventListener('error', () => {
      if (poster.dataset.fallback !== 'true') {
        poster.dataset.fallback = 'true';
        poster.src = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
      } else {
        frame.classList.add('poster-unavailable');
      }
    });
  }
  button.addEventListener('click', () => {
    if (frame.querySelector('iframe')) return;
    const player = document.createElement('iframe');
    player.className = 'huma-featured-iframe';
    player.title = 'Meet Huma — Al Huma Collection full introduction';
    player.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0';
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen; web-share';
    player.allowFullscreen = true;
    frame.append(player);
    button.hidden = true;
  });
})();