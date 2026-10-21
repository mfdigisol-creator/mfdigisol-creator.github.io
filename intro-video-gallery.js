/* Al Huma introduction gallery — Phase 1 only.
   No scheduled fetching, YouTube APIs, analytics, or social workflow dependencies. */
(() => {
  'use strict';
  const root = document.querySelector('[data-intro-video-gallery]');
  if (!root) return;
  const track = root.querySelector('[data-intro-video-track]');
  const status = root.querySelector('[data-intro-video-status]');
  const previous = root.querySelector('[data-intro-video-prev]');
  const next = root.querySelector('[data-intro-video-next]');
  const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
  let active = null;

  function stopVideo() {
    if (!active) return;
    const { holder, button } = active;
    holder.querySelector('iframe')?.remove();
    button.hidden = false;
    active = null;
  }

  function buildCard(video, index) {
    const card = document.createElement('article');
    card.className = 'intro-videos-card';
    const holder = document.createElement('div');
    holder.className = 'intro-videos-media';
    const cover = document.createElement('button');
    cover.type = 'button';
    cover.className = 'intro-videos-cover';
    const hasId = typeof video.youtubeId === 'string' && videoIdPattern.test(video.youtubeId);
    cover.disabled = !hasId;
    cover.setAttribute('aria-label', hasId ? 'Play ' + video.title + ' on YouTube' : video.title + ' video not configured');
    if (hasId) {
      const image = document.createElement('img');
      image.src = 'https://i.ytimg.com/vi/' + video.youtubeId + '/hqdefault.jpg';
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => {
        image.remove();
        const fallback = document.createElement('span');
        fallback.className = 'intro-videos-placeholder';
        fallback.textContent = index === 0 ? 'Al Huma Collection' : 'SB Stitching';
        cover.prepend(fallback);
      }, { once: true });
      cover.append(image);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'intro-videos-placeholder';
      placeholder.textContent = index === 0 ? 'Al Huma Collection' : 'SB Stitching';
      cover.append(placeholder);
    }
    const mark = document.createElement('span');
    mark.className = 'intro-videos-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '\u25b6';
    cover.append(mark);
    cover.addEventListener('click', () => {
      if (!hasId) return;
      stopVideo();
      cover.hidden = true;
      const iframe = document.createElement('iframe');
      iframe.className = 'intro-videos-player';
      iframe.title = 'YouTube: ' + video.title;
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + video.youtubeId + '?autoplay=1&playsinline=1&rel=0';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      holder.append(iframe);
      active = { holder, button: cover };
    });
    holder.append(cover);
    card.append(holder);
    const tag = document.createElement('span');
    tag.className = 'intro-videos-tag';
    tag.textContent = video.category;
    card.append(tag);
    const heading = document.createElement('h3');
    heading.textContent = video.title;
    card.append(heading);
    if (hasId) {
      const link = document.createElement('a');
      link.className = 'intro-videos-watch-link';
      link.href = 'https://www.youtube.com/shorts/' + video.youtubeId;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Watch on YouTube ↗';
      link.setAttribute('aria-label', 'Watch ' + video.title + ' directly on YouTube');
      card.append(link);
    }
    return card;
  }

  const scrollBehavior = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  function updateButtons() {
    if (!track || !previous || !next) return;
    const max = Math.max(0, track.scrollWidth - track.clientWidth);
    previous.disabled = track.scrollLeft < 5;
    next.disabled = track.scrollLeft >= max - 5;
    const noOverflow = max < 5;
    previous.hidden = noOverflow;
    next.hidden = noOverflow;
  }

  function initialize(config) {
    const videos = Array.isArray(config?.videos) ? config.videos.slice(0, 2) : [];
    if (videos.length !== 2) {
      status.textContent = 'Watch our introductions on the official YouTube channel.';
      return;
    }
    videos.forEach((video, index) => track.append(buildCard(video, index)));
    status.remove();
    updateButtons();
    track.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons, { passive: true });
    previous.addEventListener('click', () => {
      track.scrollBy({ left: -(track.firstElementChild?.clientWidth || 250) - 22, behavior: scrollBehavior() });
    });
    next.addEventListener('click', () => {
      track.scrollBy({ left: (track.firstElementChild?.clientWidth || 250) + 22, behavior: scrollBehavior() });
    });
  }

  fetch('/intro-video-gallery.json', { credentials: 'same-origin' })
    .then(response => { if (!response.ok) throw new Error('Video config not available'); return response.json(); })
    .then(initialize)
    .catch(() => { status.textContent = 'Watch our introductions on the official YouTube channel.'; });
})();
