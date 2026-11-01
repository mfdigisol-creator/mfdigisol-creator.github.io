import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const html = read('index.html');
const config = JSON.parse(read('intro-video-gallery.json'));
const css = read('intro-video-gallery.css');
const js = read('intro-video-gallery.js');

assert.equal(config.phase, 'phase2-five-curated-introductions');
assert.equal(config.updateMode, 'manual', 'Gallery must not use automatic discovery');
assert.equal(config.maximumVideos, 5);
assert.equal(config.videos.length, 5, 'There must be exactly five selected videos');
assert.deepEqual(config.videos.map(v => v.key), [
  'al-huma-introduction',
  'sb-stitching-introduction',
  'al-huma-fashion-designer',
  'al-huma-fashion-stylist',
  'sb-stitching-master-tailor'
]);
assert.deepEqual(config.videos.map(v => v.youtubeId), [
  'rutTiVJwemw',
  'oH6g9qsHfg4',
  'f8koXC-71w8',
  'aEO8gbDQyX4',
  'VBchayLmExg'
]);
const validVideoId = /^[A-Za-z0-9_-]{11}$/;
assert.ok(config.videos.every(v => validVideoId.test(v.youtubeId)), 'All video IDs must be valid');
assert.equal(new Set(config.videos.map(v => v.youtubeId)).size, 5, 'No duplicate videos');
assert.ok(config.videos.every(v => typeof v.title === 'string' && v.title.length > 4));
assert.ok(config.videos.every(v => typeof v.category === 'string' && v.category.trim()));

const find = token => html.indexOf(token);
assert.ok(find('id="watch-our-story"') > find('id="story"'));
assert.ok(find('id="watch-our-story"') < find('id="live-catalogue"'));
assert.equal((html.match(/data-intro-video-gallery/g) || []).length, 1);
assert.ok(html.includes('intro-video-gallery.css') && html.includes('intro-video-gallery.js'));
assert.ok(html.includes('data-huma-featured'), 'The separate widescreen video must remain');
assert.ok(html.includes('https://youtu.be/NfXIKX68l8M'), 'Widescreen video ID must remain unchanged');
assert.ok(!/<iframe[^>]*youtube/i.test(html), 'No YouTube player should load on initial paint');
assert.ok(js.includes('videos.slice(0, 5)'), 'Five-video cap missing');
assert.ok(js.includes("document.createElement('iframe')"), 'Click-to-play loader missing');
assert.ok(js.includes("cover.addEventListener('click'"), 'User gesture is required');
assert.ok(js.includes('stopVideo();'), 'Only one Shorts player should be active');
assert.ok(js.includes('www.youtube-nocookie.com/embed/'), 'Privacy-enhanced player expected');
assert.ok(!js.includes('setInterval(') && !js.includes('youtube/v3'), 'No background synchronization');
assert.ok(css.includes('scroll-snap-type: x mandatory'));
console.log('PASS: five manual Shorts, original two fixed, widescreen feature preserved, no automatic synchronization.');
