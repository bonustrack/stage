# @metro-labs/railgun-mobile

Self-contained, version-pinned Railgun mobile bridge. Phase 2 (this PR) lands the
**typed contract seam**; the physical code move is a follow-up that needs an APK
to validate (native build graph), so it is intentionally deferred.

## What this package exposes today (phase 2)

The public typed barrel (`src/index.ts`) re-exports the single bridge contract
and the shared method registry:

- `RailgunBridgeAPI` - the one interface enumerating the whole bridge surface
  (engine lifecycle, wallet, balances, shield / transfer / unshield flows).
- `SDK_METHODS` / `SDK_METHOD()` - the single source of truth for the dispatch
  method names. The RN frame builders reference these as typed literals (a typo
  is a compile error); the Node host validates its whitelist against the
  generated manifest, so the contract and the host **cannot desync**.

The contract + registry physically live in `@stage-labs/client/railgun` (the
pure, framework-agnostic module both the RN client and the Node host already
import); this barrel is the stable public name the app will migrate to.

## The desync-proof pipeline

```
packages/client/src/railgun/methods.ts   (SDK_METHODS - single source of truth)
        |  apps/app/scripts/gen-railgun-methods.mjs (codegen)
        v
apps/app/nodejs-assets/nodejs-project/railgun-methods.json  (manifest)
        |  asserted at host boot (main.js -> sdkDispatch.assertWhitelistParity)
        |  asserted in CI (apps/app/test/railgunMethodParity.test.ts)
        v
sdkDispatch.js WHITELIST must equal the manifest  (else build fails)
```

Adding a bridge method = add it to `SDK_METHODS`, run the codegen, add the host
whitelist entry. Forgetting the host side fails the parity test in CI instead of
shipping a primitive that only rejects at proof time on a device.

## Remaining for the physical move (follow-up + APK)

1. Move `apps/app/nodejs-assets/nodejs-project/*` (main.js, engine.js,
   sdkDispatch.js, railgun-methods.json, scripts) into this package.
2. Move the Expo plugins (`withNodejsMobile.js`, `nodejsMobileConfig.js`,
   `withGradleMemory.js`) here behind `./plugin`.
3. Move the RN client (`apps/app/lib/railgun/bridge/*`) here as the concrete
   `RailgunBridgeAPI` implementation; the app imports the barrel only.
4. Re-point `apps/app/metro.config.js` blockList, `app.config.js` plugin paths,
   and `scripts/install-nodejs-project.js` at the new location.
5. Pin the `@railgun-community/*` + `@railgun-privacy/native-prover` versions in
   this package's `package.json` (today they live in nodejs-project/package.json).

Each step touches the native build graph, so they ship with a matching APK
rebuild (native-dep / APK sequencing rule). Do NOT point the served bundler at a
branch with these moves before the APK is installed.

## Also deferred: stateless engine

Moving the wallet/balance cache from the Node engine to RN (so the engine is
stateless/restartable) is a behavior change that needs on-device validation; it
is noted here and left for a follow-up.
