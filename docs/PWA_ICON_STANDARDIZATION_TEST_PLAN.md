# SARINA PWA icon standardization — 2026-11-23

## Scope
This branch standardizes the web app manifest icon declarations while preserving the approved SARINA mark (green and gold/orange human figures, leaves, protective arch).

## Changes prepared
- Keep the verified 192×192 WebP icon as the regular 192 icon.
- Add a 512×512 SVG wrapper using the same approved 192×192 artwork for scalable manifest delivery.
- Add a dedicated 512×512 maskable SVG. Its source artwork is centered in a 280×280 square on a 512×512 white canvas; the artwork square's half-diagonal is about 198 px, inside the 204.8 px radius of the 40%-safe-zone circle.
- Remove the visually inconsistent 512×512 WebP from the manifest declaration (the asset remains in the repository but is no longer selected by the manifest).
- Bump the service-worker shell cache to v9 and precache both new SVG assets.

## Important limitation
The 512×512 SVG wraps the approved 192×192 WebP artwork; it is scalable as an SVG document but does not create new 512-pixel source detail. A clean, lossless 512×512 PNG/WebP export from the original approved master artwork remains the preferred production asset. Do not mark the icon task fully complete until that master export and real-device install tests are done.

## Acceptance checks
1. Parse `public/manifest.webmanifest` as JSON.
2. Confirm each manifest icon URL returns HTTP 200 with the declared MIME type.
3. Confirm the 192 icon is 192×192, and both SVG documents render at 512×512.
4. Validate the maskable artwork stays inside the central 80% safe zone using Android adaptive-icon previews.
5. Inspect manifest and service worker in Chrome DevTools; ensure no failed precache requests.
6. Run production build and relevant CI checks on this branch.
7. On a real Android device in current Chrome: open the deployed HTTPS origin, verify install eligibility, install, launch, inspect home-screen icon and splash screen, update once, then verify offline shell behavior.
8. On iOS Safari: add to Home Screen and inspect the 180×180 Apple touch icon.
9. Record device model, OS, browser version, deployment URL, date, screenshots, and each pass/fail result.

## Status
Prepared on an isolated branch. Build, deployed HTTP/MIME checks, browser tests, and real-device tests are pending. No changes are merged to `main`.
