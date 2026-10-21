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
