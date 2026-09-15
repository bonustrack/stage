# Frozen legacy identifiers

Stage shipped under an earlier name. Every name in the codebase has since been
renamed (components, helpers, the `stage-pill` native module, tests, docs),
and the app emits `stage://` conversation lines. The identifiers below
deliberately keep the earlier string because changing them would break
existing installs, messages or store listings. Do not rename these; add new
ones under `stage`.

| Identifier | Where | Why it stays |
|---|---|---|
| `authorityId: 'metro.box'` | `packages/client/src/xmtp/codecs.ts` | XMTP content-type ids are part of every message already sent; a new id makes old polls/signature requests undecodable. |
| `metro:` / `metro://` as an *accepted* scheme | `xmtp/line.ts`, `text/markdown.ts`, `lib/safeOpenLink.ts`, `lib/previewLinkDetect.ts`, `lib/cardLinks.ts` | Old links in chat history must still open. New links are always `stage://`. |
| `box.metro.monitor` | `app.config.js`, `.well-known/*`, `google-services*.json` | iOS bundle id / Android application id. A new id is a new app on the stores. |
| EAS `slug: 'metro'` | `app.config.js` | Tied to the EAS project the builds and OTA updates belong to. |
| Firebase project `metro-e47f6` | `google-services*.json`, `lib/firebaseWeb.ts`, `apps/push/fly.toml` | GCP project id, immutable. |
| `METRO_CTRL:` | `lib/pushRegister.control.ts` | Wire prefix of push control messages; must match the push server. |
| Notification channels `metro-conversations` / `metro-messages`, prefs `metro_pill`, category `box.metro.pill.category.CONVERSATION` | `modules/stage-pill/android` | Android persists per-channel user settings and preferences under these ids. |
| `metro:lastRoute:v1`, documents dir `metro/` | `lib/lastRoute.ts`, `lib/appDocuments.ts` | Read once and migrated to the `stage` equivalents on first launch; the constants only survive as the migration source. |
