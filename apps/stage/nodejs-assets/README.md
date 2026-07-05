# RAILGUN embedded-Node host (`nodejs-assets/nodejs-project`)

This folder is the **Node runtime host** for the RAILGUN private wallet. It runs
the RAILGUN engine and the Groth16 **native prover** inside
[`nodejs-mobile-react-native`](https://github.com/nodejs-mobile/nodejs-mobile-react-native),
NOT in Hermes.

## Why a separate Node process at all

`@railgun-privacy/native-prover` (the on-device Groth16 prover) is a **Node
N-API `.node` addon** compiled via node-gyp. Hermes — the JS engine RN/Expo uses
— **cannot load a Node N-API addon**. So proving (shield / transfer / unshield)
is impossible in the RN VM. RAILGUN's own reference app, Railway-Wallet, solves
this by running the whole engine inside an embedded Node runtime and talking to
it over an IPC channel. This is that host, ported to our app.

## How it connects to the app

- RN side: `apps/app/lib/railgun/bridge/` (`index.ts` client, `protocol.ts`
  wire types, `nodejsMobile.ts` guarded feature-detection).
- Wire protocol: requests on channel event `rg:request` `{ id, call, params }`,
  replies on `rg:reply` `{ id, ok, result?, error? }`, plus push events
  (`event:proofProgress`, `event:balanceUpdate`, …). See `protocol.ts`.
- Metro never bundles this folder — it is in `metro.config.js`
  `resolver.blockList` and `eslint.config.mjs` ignores. `nodejs-mobile-react-
  native` bundles `nodejs-project/` into the native binary at build time.

## Current status: ENGINE WIRED (Milestone 1)

`main.js` boots + answers `ping` dependency-free, and now also wires the RAILGUN
engine via `engine.js`, loaded lazily on the first `engineInit` / `engineStatus`
bridge call:

- `nodejs-project/package.json` declares the real engine deps (mirrors RAILGUN
  Railway-Wallet's known-good set): `@railgun-community/wallet@10.8.6`,
  `@railgun-community/shared-models@8.0.1`, the `@railgun-privacy/native-prover`
  IPFS tarball (v4.0.3), `leveldown-nodejs-mobile@6.0.1-1`, `ethers@6.14.3`,
  `nodejs-mobile-ipc2@1.1.0`.
- `engine.js` runs `startRailgunEngine(...)` with a LevelDOWN db + fs artifact
  store, loads the Groth16 native prover (`getProver().setNativeProverGroth16`),
  and loads mainnet + Sepolia providers. `engineStatus` / `engineInit` report
  `{ ready, prover, networks, version }`.
- `scripts/patch-native-prover.js` (postinstall) fixes the native-prover's broken
  node-gyp-build binding path so the prebuilt `.node` resolves (same fix RAILGUN
  applies via patch-package).
- `node_modules` are NOT committed; EAS installs them via the
  `eas-build-post-install` hook (`apps/app/scripts/install-nodejs-project.js`).
  nodejs-mobile-react-native's gradle then rebuilds the native `.node` per ABI
  and bundles the project into the APK. Builds are arm64-v8a only (eas.json),
  which matches the only Android prebuild the prover ships.

Full private send/receive (wallet:create, tx:*, proof:*) is the next milestone.
