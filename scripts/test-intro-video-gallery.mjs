import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../'+file, import.meta.url), 'utf8');
const html = read('index.html');
const config = JSON.parse(read('intro-video-gallery.json'));
const css = read('intro-video-gallery.css');
const js = read('intro-video-gallery.js');
assert.equal(config.phase, 'phase1-fixed-introductions');
assert.equal(config.videos.length, 2, 'Phase 1 must show exactly two items');
assert.deepEqual(config.videos.map(v => v.key), ['al-huma-introduction','sb-stitching-introduction']);
const pattern = /^[A-Za-z0-9_-]{11}$/;
for (const item of config.videos) {
  assert.equal(typeof item.title, 'string');
  assert.ok(item.title.length > 4);
  assert.ok(item.youtubeId === '' || pattern.test(item.youtubeId), 'Video ID must be blank or valid');
}
if (process.argv.includes('--ready-for-merge')) {
  assert.ok(config.videos.every(v => pattern.test(v.youtubeId)),
    'MERGE BLOCKED: owner must provide and verify both YouTube video IDs');
  assert.equal(new Set(config.videos.map(v => v.youtubeId)).size, 2);
}
const find = token => html.indexOf(token);
assert.ok(find('id="watch-our-story"') > find('id="story"'));
assert.ok(find('id="watch-our-story"') < find('id="live-catalogue"'));
assert.equal((html.match(/data-intro-video-gallery/g) || []).length, 1);
assert.ok(html.includes('intro-video-gallery.css') && html.includes('intro-video-gallery.js'));
assert.ok(!/<iframe[^>]*youtube/i.test(html), 'No YouTube player should load on first paint');
assert.ok(js.includes('document.createElement(\'iframe\')'), 'Click-to-play loader missing');
assert.ok(js.includes('stopVideo();'), 'Only one player should be active');
assert.ok(js.includes('www.youtube-nocookie.com/embed/'), 'Privacy-enhanced player expected');
assert.ok(css.includes('scroll-snap-type: x mandatory'));
console.log('PASS: Phase 1 gallery structural tests. ' + (process.argv.includes('--ready-for-merge')?'Ready for merge IDs verified':'Preview mode (IDs pending)'));
