# Build Resources

This directory holds assets used by `electron-builder` during packaging.

Expected files (not yet present — install before running `npm run dist:*`):

- `icon.icns` — macOS app icon (512×512 source recommended)
- `icon.ico` — Windows app icon
- `icon.png` — Linux app icon (512×512)
- `background.png` — macOS DMG background (optional)
- `entitlements.mac.plist` — macOS hardened-runtime entitlements (only if enabling notarization)

See [electron-builder docs: Icons](https://www.electron.build/icons) for generation steps.
