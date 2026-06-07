# @metro-labs/railgun-mobile

Self-contained, version-pinned Railgun mobile bridge. Phase 2 landed the **typed
contract seam**; phase 3 (this package) executed the **physical move** of the RN
bridge client and the Expo native-build plugins into the package. The one piece
that stays in `apps/app` is the embedded-Node host - a fixed native-build
convention, see "What stays in apps/app" below.

## What this package exposes

The public typed barrel (`src/index.ts`):

- `RailgunBridgeAPI` + `SDK_METHODS` / `SDK_METHOD()` - the single source of
  truth for the dispatch method names (re-exported from the pure
  `@stage-labs/client/railgun`). RN frame builders reference these as typed
  literals (a typo is a compile error); the Node host validates its whitelist
  against the generated manifest, so the contract and the host **cannot desync**.
- the RN bridge client runtime (`./bridge`): `isBridgeAvailable`, `startBridge`,
  `bridgeCall` / `rawCall`, `pingBridge`, `engineStatus`, `engineInit`,
  `bridgeListen`, `walletInfo`, `getBalances`, `sdk`, the shield / transfer /
  unshield call builders, and `DEFAULT_SCAN_CONFIG`. App UI imports the barrel;
  the `apps/app/lib/railgun/*` orchestration layer imports the documented
  subpaths (`@metro-labs/railgun-mobile/bridge`, `.../bridge/shieldCalls`, etc.).

The pure, unit-tested Expo plugin transforms live under `./plugin`
(`nodejsMobileConfig`: the libnode.so pickFirst block, the aapt
ignoreAssetsPattern, `extractNativeLibs`, and the gradle heap args).
`apps/app/test/railgunPluginConfig.test.ts` asserts them. The thin
`@expo/config-plugins` runtime wrappers (`withNodejsMobile`, `withGradleMemory`)
stay in `apps/app/plugins/` and `require` these transforms from the package:
`expo/config-plugins` only resolves from the app's `node_modules` under the
non-hoisted bun workspace, so the wrappers must run in the app's resolution
context. They are one-liners; all the load-bearing, regression-prone logic is in
the package.

## What stays in apps/app (and why it MUST)

`apps/app/nodejs-assets/nodejs-project/*` (main.js / engine.js / sdkDispatch.js /
railgun-methods.json / scripts) is **not** moved. `nodejs-mobile-react-native`'s
gradle (`CopyNodeProjectAssetsFolder` -> `GenerateNodeProjectAssetsLists`) reads
the host from `<expoProjectRoot>/nodejs-assets/nodejs-project` by a fixed native
convention - the path is not configurable. Relocating it would make the native
build bundle an empty host. This package's `package.json` (`comments.embedded
NodeHostDeps`) mirrors the host's pinned `@railgun-community/*` + native-prover
versions as the single documented source of truth; bump both files together.

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

## Physical-move status (phase 3)

- [x] RN client (`apps/app/lib/railgun/bridge/*`) moved to `src/bridge/*`; app +
      `lib/railgun/*` re-pointed to the barrel / documented subpaths.
- [x] Pure Expo plugin transforms (`nodejsMobileConfig`) moved to `./plugin`; the
      plugin-config test re-pointed. The thin `withNodejsMobile` /
      `withGradleMemory` config-plugin wrappers stay in `apps/app/plugins/` and
      `require` the package transforms (expo/config-plugins is app-local only).
- [x] `@railgun-community/*` + native-prover versions mirrored into this
      package's `package.json` (`comments.embeddedNodeHostDeps`).
- [ ] `nodejs-assets/nodejs-project/*` intentionally **not** moved (fixed native
      convention - see "What stays in apps/app"). `metro.config.js` blockList is
      a path-relative `/nodejs-assets/` regex that needs no change.

These touch the native build graph, so this lands with a matching APK rebuild
(native-dep / APK sequencing rule). Do NOT point the served bundler at this
branch before the APK is installed.

## Also deferred: stateless engine

Moving the wallet/balance cache from the Node engine to RN (so the engine is
stateless/restartable) is a behavior change that needs on-device validation; it
is noted here and left for a follow-up.
