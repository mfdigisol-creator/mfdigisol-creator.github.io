# Phase 1 — Al Huma Introduction Video Gallery

## Approval scope
- **Only** two permanent public YouTube Shorts: Al Huma Collection first, SB Stitching second.
- Add one small homepage section **after The Boutique Story and before Latest Designs**.
- YouTube thumbnails display first; **one privacy-enhanced YouTube iframe loads only after clicking Play**.
- No autoplay during page load, no third-party embed scripts in the initial critical path.
- No API/OAuth secrets, Metricool calls, scheduled jobs, new workers, analytics events, or repository workflows.
- Do **not** touch `youtube-automation/`, the ongoing Social Media Operation or existing YouTube playlist manager.
- Do not merge the branch without owner visual approval and valid, verified YouTube IDs.

## Files
- `index.html`: one standalone section, CSS/script references.
- `intro-video-gallery.css`: styles scoped to `.intro-videos`.
- `intro-video-gallery.js`: carousel, one click-to-play iframe, stops prior player on the next selection.
- `intro-video-gallery.json`: **two fixed records**, no synchronization or rotating slots.
- `scripts/test-intro-video-gallery.mjs`: offline structural tests.

## Required before merge
The owner supplied the following **public Shorts links**, and their exact IDs are now stored in `intro-video-gallery.json`:
1. Al Huma Collection Introduction: https://youtube.com/shorts/rutTiVJwemw (ID: `rutTiVJwemw`).
2. SB Stitching Introduction: https://youtube.com/shorts/oH6g9qsHfg4 (ID: `oH6g9qsHfg4`).

Both IDs passed the 11-character format and unique-ID checks. **Live YouTube fetch/embedding has not been externally verified** from this execution environment, so on-device playback remains a deployment gate.

## QA / rollout gates
1. `node --check intro-video-gallery.js`
2. `node scripts/test-intro-video-gallery.mjs --ready-for-merge`
3. Inspect the two posters in a browser and verify each video plays from YouTube. A single player should be present at a time.
4. Verify on iOS/Android touch + desktop keyboard navigation. Check responsive scroll and reduced motion.
5. Measure mobile throttled page load before/after (Lighthouse or browser dev tools): ensure no YouTube iframe / API before click.
6. Verify catalogue search/filter, checkout, analytics and existing order process remain unaffected.
7. Review diff for **only intended files**. Obtain project-owner approval before merge into main.

## Rollback
Revert the small gallery commit / PR without changing any videos, YouTube settings, existing automation or product catalogue. No database migrations or credentials involved.

## Later phase, separate authorization
Rotating slots 3–5, scheduled feed/API discovery, and any integration with ongoing Social Media Operation are **explicitly out of scope** until that project is finalized after November 1.

## Additional QA — 21 October 2026 (staging attempt)

The project owner approved the visual preview and requested the next-stage isolated HTTPS staging test.

**Environment blocker:** The connected Cloudflare inspection and deployment operations returned an internal tool error. Independent Chromium navigation to `https://localhost`, mocked `https://*.test`, and `file://` URLs also returned `ERR_BLOCKED_BY_ADMINISTRATOR`. No public HTTPS staging deployment was created.

**Completed local DOM preview tests** using browser `set_content` (NOT real HTTPS):
- Desktop 1365px, tablet 768px, mobile 390px, narrow mobile 320px: 2 correctly ordered cards; no document overflow; 0 iframes before click.
- At mobile 390px, activating card 1 created one iframe targeting `rutTiVJwemw`; activating card 2 replaced it with exactly one iframe targeting `oH6g9qsHfg4`; first Play button became available again.
- JavaScript syntax and source invariants checked separately, and intended changed-file scope reviewed.

**Still NOT verified:** YouTube thumbnail requests over public HTTPS, actual external iframe playback, production CMP behavior, real network-throttled Lighthouse results, and catalogue/checkout interaction on the integrated branch. A zero-iframe initial DOM test is not a quantitative LCP/CLS performance test.

**Safety:** Draft PR #76 remains open, unmerged and undeployed. No Cloudflare resources were created or modified, and no automation, YouTube playlist manager, Meta, catalogue or checkout code was changed.

### Recommended HTTPS staging path, once Cloudflare access works
- Create an isolated **Cloudflare Pages Git preview project**, referencing this branch only; do not attach a custom domain or change DNS / the current GitHub Pages site.
- Preview via its separate `*.pages.dev` URL and run the actual browser/player + Lighthouse test gates.
- Review the branch deployment options to prevent automatic production deployments on `main`.
- Obtain the user's explicit **new approval to merge** only after the outstanding gates pass.
