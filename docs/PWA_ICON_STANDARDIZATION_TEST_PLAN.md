# SARINA PWA icon standardization — 2026-11-23

## Scope
Connect the user-approved SARINA logo export to the PWA manifest, Apple home-screen metadata, and service-worker shell cache.

## Assets uploaded to this branch
- `public/SARINA_Icon_192.png` — regular 192×192 PNG icon.
- `public/SARINA_Icon_512.png` — regular 512×512 PNG icon.
- `public/SARINA_Maskable_512-1.png` — 512×512 maskable PNG icon (the uploaded filename includes the `-1` suffix).
- `public/SARINA_Apple_Touch_180.png` — 180×180 Apple touch icon.

The assets were generated from the user-supplied 1536×1536 approved logo image, preserving the full supplied artwork and white background. The maskable variant uses the same artwork reduced and centered on a white canvas to provide padding for adaptive cropping.

## Integration changes
- `public/manifest.webmanifest` now declares the 192px, 512px, and maskable PNG files with `image/png` MIME types.
- `index.html` now points the Apple touch icon link to `/SARINA_Apple_Touch_180.png`.
- `public/sw.js` cache version is now `sarina-shell-v10` and precaches the four uploaded assets alongside the app shell.
- The legacy icon files remain in the repository but are no longer selected by the manifest or Apple touch icon link.

## Acceptance checks
1. Parse `public/manifest.webmanifest` as JSON and verify all three manifest icon paths exactly match uploaded filenames.
2. Verify the Apple touch icon link matches the uploaded 180px PNG.
3. Verify the service worker cache version is v10 and all four new asset paths are included in precache.
4. Confirm actual image dimensions and HTTP 200/MIME types from a deployed preview.
5. Run production build and relevant CI checks on this branch.
6. Validate maskable rendering with Android adaptive-icon previews; confirm no important artwork is clipped.
7. On a real Android device in current Chrome: open deployed HTTPS origin, verify install eligibility, install, launch, inspect home-screen icon and splash screen, update once, then verify offline shell behavior.
8. On iOS Safari: add to Home Screen and inspect the 180×180 Apple touch icon.
9. Record device model, OS, browser version, deployment URL, date, screenshots, and each pass/fail result.

## Current status
- User upload to the isolated branch: confirmed by fetching all four files from GitHub.
- Manifest, Apple touch link, and service-worker references: updated and committed to this branch.
- Static cross-file consistency: pending final verification.
- Build / deployed HTTP and MIME checks: pending. Previous Vercel check failed due to `build-rate-limit`; this is a quota signal, not a code-level build result.
- Browser and real-device tests: pending.
- No changes are merged to `main`.
