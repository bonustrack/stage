# Desktop release (Electron + electron-builder + electron-updater)

`.github/workflows/release-desktop.yml` builds the Stage desktop app whenever the `version` value in `apps/stage/app.config.js` changes on `main`, the same trigger as the mobile release, so one version bump ships every platform as `Stage v<version>`. `Actions -> Release Desktop -> Run workflow` rebuilds the current `main` on demand.

## What runs

| Job | What it does |
|---|---|
| `build` (macOS) | Universal `.dmg` and `.zip` (Apple Silicon + Intel). Signed and notarized when the Apple secrets exist, ad-hoc signed otherwise. |
| `build` (Linux) | `.AppImage` and `.deb`. |
| `build` (Windows) | NSIS `.exe` installer. |
| `publish` | Attaches the installers, the `.blockmap` files and the `latest*.yml` update manifests to the GitHub Release `v<version>`, appending to the release the mobile workflow creates. |

The version in `apps/desktop/package.json` is stamped from `app.config.js` at build time; keep it in sync when bumping so local builds report the same number.

## Auto-updates

The app uses electron-updater with the GitHub provider (`publish` in `apps/desktop/electron-builder.yml`). It checks on launch and every six hours, and `Help -> Check for Updates…` checks on demand.

- Windows and Linux download the update in the background and offer "Restart now" when it is ready. The update also installs on quit.
- macOS only offers to open the release page, because Squirrel.Mac refuses to install an update into an app that is not signed with a Developer ID. Flip `installsInPlace` in `apps/desktop/src/updateModel.ts` once signed builds ship.

electron-updater picks the newest `v<version>` release, so a mobile-only release without desktop assets would make desktop update checks fail until the next full release. The shared trigger keeps both workflows on the same versions.

## Secrets

Repo `Settings -> Secrets and variables -> Actions`. All optional; without them the macOS build is ad-hoc signed and Gatekeeper asks the user to allow it in System Settings.

| Name | What |
|---|---|
| `DESKTOP_MAC_CERT_P12` | Developer ID Application certificate, exported from Keychain Access as `.p12` and base64-encoded (`base64 -i cert.p12 \| pbcopy`). Needs the Apple Developer Program. |
| `DESKTOP_MAC_CERT_PASSWORD` | The password chosen when exporting the `.p12`. |
| `ASC_API_KEY_ID`, `ASC_API_KEY_ISSUER_ID`, `ASC_API_KEY_P8` | Shared with the iOS release (see `docs/mobile-release.md`). Used for notarization; only applied when the certificate is present. |

`EXPO_PUBLIC_ZERODEV_PROJECT_ID` and `EXPO_PUBLIC_SWARMY_KEY` are the public values inlined into the web bundle.

## Creating the Developer ID certificate

1. developer.apple.com -> Certificates -> `+` -> **Developer ID Application**. Only the Account Holder can create this type.
2. Upload a certificate signing request made in Keychain Access (Certificate Assistant -> Request a Certificate From a Certificate Authority, saved to disk).
3. Download the `.cer`, double-click to add it to the login keychain, then export the certificate together with its private key as `.p12` and set the two secrets above.

## Local build

```sh
bun run --cwd apps/desktop dist
```

Produces the installers and `latest-mac.yml` in `apps/desktop/release/`. Run Electron from a plain terminal: editor terminals set `ELECTRON_RUN_AS_NODE`, which makes Electron start as Node and exit.
