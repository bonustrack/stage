# Chrome extension

Stage's Chrome extension bundles the same production Expo web app as the website and desktop app. The side panel stays open while you browse. It does not embed stage.box, inject into websites, or run a second messaging client in the background.

## Build and load

Use Bun 1.4.0 and Node 22 or later, from the repository root:

```sh
bun install --frozen-lockfile
BROWSER=none bun scripts/build-extension.mjs /absolute/path/to/stage-extension
```

Choose an empty output directory. Use the same public `EXPO_PUBLIC_*` build configuration as the web app. In particular, `EXPO_PUBLIC_ZERODEV_PROJECT_ID` (or `EXPO_PUBLIC_ZERODEV_RPC`) is required for smart-account setup and `EXPO_PUBLIC_SWARMY_KEY` for uploads. These are client-side values, not private wallet keys. Never put a recovery phrase, private key, or server-only secret in build variables.

The Chrome extension PR workflow also builds a `stage-chrome-extension` artifact with the repository's public client configuration. Download and extract it before loading it. This is an unpacked beta, not a Chrome Web Store release.

1. In Chrome 116 or later, open `chrome://extensions`.
2. Enable Developer mode, choose **Load unpacked**, and select the directory containing `manifest.json`.
3. Pin Stage and click its toolbar icon to open the side panel.
4. Use Stage's existing create-account or import/device-link flow. Signing in on stage.box does not sign in the extension.

For a full-width view, open the extension's `index.html#/` URL in a tab. Its ID appears in `chrome://extensions`. Stage's existing single-tab lock coordinates the tab and side panel; use one active Stage surface at a time.

## Updates and storage

Keep the unpacked directory at the same absolute path. Replace its contents with a new build, then click **Reload** in `chrome://extensions`. Moving an unpacked extension can change its ID and therefore its storage origin. Uninstalling removes its local data. Back up the account using Stage's existing flow before uninstalling or changing extension identity. A future Store installation is a separate origin unless its ID matches; no automatic key transfer is provided.

The extension reuses Stage's web keyring, localStorage, IndexedDB cache, OPFS database and account lifecycle. It does not copy keys from the website, introduce `chrome.storage` synchronization, or expose a website/content-script signing bridge. Like the web app, recovery material is stored in the browser profile without an additional app-level encrypted vault or native biometric prompt. Do not treat this as a hardware wallet or import a valuable account solely for testing.

## Permissions and lifecycle

The only extension permission is `sidePanel`. There are no host permissions, content scripts, external-message handlers, alarms, offscreen documents or persistent background chat. APIs still need to allow normal cross-origin requests, as they do for the web app.

The toolbar and native side-panel header reuse transparent PNGs rendered from `public/favicon.svg`. Chrome's stable extension icon API cannot select light/dark variants for both surfaces, so the packaged logo uses a neutral grey that is readable on light and dark backgrounds. The app's SVG favicon still follows its existing colour-scheme rules. No theme watcher or extra permission is needed.

The small event-driven service worker only configures the toolbar action. The panel owns the app and its messaging workers. Closing every Stage extension surface stops that client; reopening reconnects with its saved installation and catches up. Closed-panel push notifications are not implemented, and the website's Firebase service worker is not registered by the extension. Chrome controls service-worker suspension and background-tab throttling.

JavaScript, workers, fonts and XMTP WebAssembly are packaged locally. The Manifest V3 policy allows packaged scripts and WebAssembly compilation, not inline JavaScript, JavaScript evaluation, remote executable code or iframes. COOP/COEP enable the same shared-memory database support as Stage web. The existing logo and Kit UI are unchanged.

External links open in browser tabs. Attachments use the same file picker and encrypted upload path as Stage web. Camera and microphone prompts remain browser-controlled, with no blanket extension access added. Real messaging, device linking, uploads, calls and wallet transactions still need an account and backend connectivity; synthetic browser checks are not proof of those live actions.
