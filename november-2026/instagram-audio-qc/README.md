# November 2026 — Instagram AAC media QC and replacement

Prepared: 2026-11-01 (Asia/Karachi). This is **an operations record, not a publish instruction**.

## Prepared deliverables

| Scheduled item | Original Metricool post ID | UUID | Corrected asset | Duration | Audio | SHA-256 |
|---|---:|---|---|---:|---|---|
| Video 01 — Instagram Reel, Nov 7 20:00 PKT | 413021374 | 2851761400324312381 | Al_Huma_Video01_Instagram_AAC128_QC.mp4 | 25.008 s | AAC LC stereo 48 kHz nominal 128 kbps, measured 130734 bps | e1c6e16c1b09aff77a8f792d1a336e1470691caa42dc17e7bdf9f3ad57cc843e |
| Video 02 — Instagram Reel, Nov 14 20:00 PKT | 413022991 | -577090646415094914 | SB_Stitching_Video02_Instagram_AAC128_QC.mp4 | 28.000 s | AAC LC stereo 48 kHz nominal 128 kbps, measured 130488 bps | 4099941f6de95779ac2bfaf9612a4ce568e5489c779716107fa01a2fd8bf863c |

Both MP4s are H.264, 720x1280, 25 fps. The video stream was copied without re-encoding. Both source files are in the ChatGPT project file library and were imported successfully to Canva as assets:
- Video 01 Canva asset: `VAHZsNRavIU`
- Video 02 Canva asset: `VAHZsL8gPh8`

**Do not attempt to schedule from Canva temporary/signed thumbnail URLs.** A confirmed durable public media URL or a direct upload via Metricool's web interface is required.

## Safe replacement protocol

1. Inspect the current Metricool planner, brand ID `7166730`, and confirm that both original Instagram posts are still PENDING.
2. In Metricool, edit only the existing Instagram Reel at Nov 7 20:00 PKT; upload corrected Video 01 MP4 from the computer to replace the current attached MP4. Keep the caption, date, autoPublish, provider, and Reel mode.
3. Edit only the existing Instagram Reel at Nov 14 20:00 PKT; upload corrected Video 02 MP4. Preserve `instagramData.isAiGenerated=true`, Reel/showInFeed flags, captions, date, autoPublish.
4. Save, then read back the posts; require nonempty `media`, `static.metricool.com/planner/` URL, autoPublish=true, draft=false, matching planned time and platform. Confirm no duplicates.
5. If any upload or save fails, **leave the original scheduled post unchanged**. Do not delete or create a duplicate.

The corrected files are **NOT** yet attached to the current Metricool posts. Existing scheduled posts remained intact at previous verified readback.

See `november-2026/carousel02/manifest.json` and `november-2026/video03/production-brief.json` for future approved-batch preparation.
