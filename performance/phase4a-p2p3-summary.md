# Phase 4A P2/P3 Staging Summary

Generated: 2026-07-31

## Implemented

- Replaced the timestamped `cache: "no-store"` catalogue fetch with a content-versioned, browser-cacheable request.
- Deferred the complete catalogue download and render until the visitor approaches the catalogue, uses catalogue navigation, opens a product query URL, or opens the assistant.
- Preserved catalogue synchronization timestamps, stale-data notices, retry behavior, analytics events and supplier-failure handling.
- Replaced the full-screen loader's `window.load` dependency with release after the initial rendering opportunity and a 900 ms safety release.
- Moved the assistant rule engine into `assistant-runtime.js` and load it only on assistant hover, focus or click.
- Added a catalogue snapshot bridge so the assistant works whether it loads before or after catalogue data.
- Added independent content hashes for catalogue data, catalogue JavaScript and assistant JavaScript.
- Preserved the Stage P1 hero, font-discovery and generated-image-priority improvements.

## Validation

- Catalogue generation: 1,220 active product pages, 1 discontinued-product page and 52 collection pages.
- Catalogue validator: passed with the existing two non-blocking warnings.
- Merchant policy validator: passed.
- `assistant-runtime.js`: syntax check passed.
- `dawood-catalogue.js`: syntax check passed.
- Controlled invalid URL: HTTP 404 and custom document passed.
- Lighthouse: 60 successful audits, representing three runs for each of ten page types on mobile and desktop.

## Homepage Results

| Metric | Stage P1 single run | P2/P3 median of 3 | Directional change |
|---|---:|---:|---:|
| Mobile performance | 42 | 89 | +47 points |
| Mobile LCP | 14.900 s | 3.079 s | 79.3% lower |
| Mobile TBT | 1.211 s | 0 s | eliminated in the lab run |
| Mobile Speed Index | 5.197 s | 2.929 s | 43.6% lower |
| Desktop performance | 88 | 99 | +11 points |
| Desktop LCP | 2.260 s | 0.763 s | 66.2% lower |
| CLS | 0 | 0 | unchanged |

The P1 baseline was a single pass while the P2/P3 result is a three-run median. The comparison is therefore directional rather than a controlled statistical experiment. All three new homepage runs were essentially identical: performance 89, LCP approximately 3.08 s and TBT 0.

## Remaining Gates

- Visual regression review on representative mobile and desktop widths.
- Interaction testing for catalogue navigation, filters, product dialog, cart, checkout, consent, analytics and assistant behavior.
- Production-origin PageSpeed and later field-data monitoring after any separately approved deployment.
- Separate approval before merging or deploying PR #3.
