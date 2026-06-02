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

## Current status: SCAFFOLD ONLY

`main.js` boots and answers every call with a clear "engine not wired yet"
error. The actual engine deps are **not installed** and
`nodejs-mobile-react-native` is **not yet an app dependency**, so this is inert
and commits cleanly without breaking the Metro bundle.

## Next steps (require a NEW APK)

1. Add the RN dep: `nodejs-mobile-react-native` (+ its Expo config-plugin
   support / a custom plugin — there is no first-party Expo plugin; see the
   integration plan). This is a native module → prebuild + a new dev-client APK.
2. Install the node-host deps listed in `nodejs-project/package.json` (the
   `_todo_*` keys): `@railgun-community/wallet`, `@railgun-community/shared-
   models`, the `@railgun-privacy/native-prover` IPFS tarball,
   `leveldown-nodejs-mobile`, `ethers`, `nodejs-mobile-ipc2`.
3. Wire the engine in `main.js` (startRailgunEngine → setNativeProverGroth16 →
   register a handler per `BridgeCall`).
4. Build native modules per Android ABI + bundle the node project, then ship a
   new APK. The prover + circuits add tens of MB to the binary.
