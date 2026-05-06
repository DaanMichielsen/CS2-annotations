# Packaging Notes

## Scripts

- `pnpm --filter @cs2ann/desktop dist:release`
  - Production packaging flow.
  - Uses electron-builder defaults (`asar` enabled).
  - Used by GitHub release workflow for `v*` tags.

- `pnpm --filter @cs2ann/desktop dist:local`
  - Local packaging workaround flow.
  - Forces `--config.asar=false` to avoid local Windows file-lock issues seen during ASAR integrity embedding.
  - Use for local installer smoke tests only.

## CI and Releases

- `.github/workflows/release.yml` runs:
  - `pnpm --filter @cs2ann/desktop dist:release`
- This keeps tagged release artifacts aligned with recommended ASAR-enabled packaging.

## Known Local Windows Issue

Some environments lock generated `.exe` files during packaging (Defender/indexer/Explorer handles), causing `EBUSY` failures in electron-builder.

If `dist:release` fails locally with `EBUSY`, use `dist:local` for local validation and rely on CI release builds for final artifacts.
