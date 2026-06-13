# ZeroDev smart-account wallet for Stage (issue #531)

Status: SPEC / design doc. No app code in this PR. Decision LOCKED: ZeroDev only (no Rhinestone).

Goal: add an ERC-4337 / ERC-7579 ZeroDev Kernel smart account on Base, gasless via the ZeroDev
paymaster, with a passkey (Secure Enclave) primary signer + a mnemonic-derived ECDSA backup owner,
native ZeroDev guardian social recovery, counterfactual lazy deploy, and multi-account HD derivation.
It sits alongside the existing EOA registry (`lib/accounts.ts`) - it does not replace it. The smart
account is ALSO the XMTP identity (SCW via ERC-1271/6492, XMTP RN SDK 5.7) - see 3.3.

All API names below were verified against the real SDK: `@zerodev/sdk` 5.5.x,
`@zerodev/ecdsa-validator` 5.4.x, `@zerodev/weighted-ecdsa-validator` 5.4.x,
`@zerodev/passkey-validator` 5.6.0, `@zerodev/webauthn-key`, `@zerodev/react-native-passkeys-utils`,
the `zerodevapp/zerodev-examples` repo (create-account, guardians/recovery.ts,
guardians/recovery_call.ts) and `zerodevapp/react-native-passkey-example` (verified June 2026).

**DESIGN UPDATE (June 2026): NO SERVER.** Earlier drafts called for a self-hosted 4-route
SimpleWebAuthn passkey server (folded into the Metro daemon). After reading the actual
`@zerodev/react-native-passkeys-utils`, `@zerodev/webauthn-key` and `react-native-passkeys` source,
that server is NOT required for a single-user self-custody wallet. The whole passkey flow runs
on-device + on-chain. See section (z) for the definitive verdict and the exact serverless
construction; the passkey section below is written for the serverless design.

---

## 0. How this maps onto the existing wallet

Current state (read from the repo):

- `lib/accounts.ts` is a multi-account registry. Each `AccountRecord` is `generated | privateKey |
  walletconnect`. Local keys live in `expo-secure-store` under `wallet.pk.<id>`; the list under
  `accounts.list`; active pointer under `accounts.active`. Each account gets its own XMTP sqlite db
  (`xmtp-<id>`). `@stage-labs/client/accounts/*` holds the pure rules; `accounts.keys.ts` does the
  secure-store IO and resolves a viem `PrivateKeyAccount`.
- `lib/x402.pay.ts` is the only on-chain-ish path today: it signs an EIP-3009
  `transferWithAuthorization` (gasless USDC permit) with the active viem account and POSTs the
  `X-PAYMENT` header to the proxy. It does NOT broadcast a tx and does NOT use a bundler.
  `getActiveViemAccount()` returns null for WC accounts -> falls back to wagmi `signTypedData`.
- `lib/walletconnect.ts` is Reown AppKit on mainnet, EIP-191 only (used for XMTP registration).
- Wallet UI: `app/(tabs)/wallet.tsx` + `components/tabs/WalletScreen*.tsx` (balances/activity/nfts);
  account management in `components/AccountsManager*.tsx`, `app/accounts.tsx`,
  `components/tabs/SettingsScreen.account.tsx`.
- `app.config.js` is the two-variant (Metro dev / Stage prod) Expo config. Hosts are `metro.box` (dev)
  and `stage.box` (prod). iOS already declares `associatedDomains: ['applinks:<host>']`. Android has
  `autoVerify` intent filters for `https://<host>`. New-arch is ON. There is already a precedent for
  native-module-gated features (Railgun) with the "needs a new APK" gate.
- Shims: `lib/cryptoShim.ts` (getRandomValues) is imported before any viem import; `lib/jsPolyfills.ts`
  + `metro.shims` provide Buffer/TextEncoder etc. ZeroDev's RN needs exactly these, so the polyfill
  base is already in place.

What is NEW (a smart account is a different kind of account):

- A 4th account type `smart` (a ZeroDev Kernel). Its `id`/`address` is the COUNTERFACTUAL Kernel
  address, not an EOA. It is backed by two underlying signers (passkey + a derived owner key) and a
  ZeroDev RPC.
- DECISION CHANGED: the SMART ACCOUNT IS THE XMTP IDENTITY (it is no longer wallet-only). The XMTP RN
  SDK (5.7) supports smart-contract-wallet (SCW) identities via ERC-1271 / ERC-6492, so the Kernel
  address registers the XMTP inbox directly. The smart account is both the user-facing wallet AND the
  messenger identity. See section 3.3 for the signer change and caveats.

---

## (a) Packages to add

Direct deps (JS, autolinked - no native code of their own except where noted):

```
@zerodev/sdk                          # createKernelAccount, createKernelAccountClient,
                                      # createZeroDevPaymasterClient, getUserOperationGasPrice
@zerodev/ecdsa-validator              # signerToEcdsaValidator, getValidatorAddress
@zerodev/weighted-ecdsa-validator     # createWeightedECDSAValidator, getRecoveryAction (guardians)
@zerodev/passkey-validator            # toPasskeyValidator, PasskeyValidatorContractVersion
@zerodev/webauthn-key                 # toWebAuthnKey, WebAuthnKey
@zerodev/react-native-passkeys-utils  # parsePasskeyCred, parseLoginCred,
                                      # signMessageWithReactNativePasskeys
```

NATIVE dep (this is the one that forces a new APK):

```
react-native-passkeys                 # WebAuthn create/get bridged to Secure Enclave / Android
                                      # Credential Manager. Native module -> prebuild + new APK.
```

Already present, reused: `viem` (account-abstraction submodule `viem/account-abstraction` ships
`entryPoint07Address`, `EntryPointVersion`), `expo-secure-store`, the crypto/Buffer shims.

Note: several `@zerodev/*` packages already resolve in `node_modules` as TRANSITIVE deps today; they
are NOT in `apps/app/package.json`. We add them as direct deps at the versions above. `@zerodev/sdk`
5.5.10 / `ecdsa-validator` 5.4.9 / `weighted-ecdsa-validator` 5.4.4 are already on disk, so the JS
half adds little weight; `react-native-passkeys` is the only true native addition.

Constants used throughout: `entryPoint = getEntryPoint('0.7')` (EntryPoint v0.7),
`kernelVersion = KERNEL_V3_1` (Kernel v3.1, the ERC-7579 modular version), `chain = base` (8453).

A small helper module `lib/zerodev/` mirrors the `lib/railgun/` shape:
- `lib/zerodev/client.ts` - build publicClient + paymasterClient + kernel client for an account.
- `lib/zerodev/passkey.ts` - register/login passkey -> `WebAuthnKey`, fully on-device (wraps
  react-native-passkeys + `parsePasskeyCred` / `signMessageWithReactNativePasskeys`). NO server calls.
- `lib/zerodev/account.ts` - createKernelAccount with sudo=passkey, regular=owner-ecdsa; address calc.
- `lib/zerodev/recovery.ts` - guardian validator + getRecoveryAction install + doRecovery.
- `lib/zerodev/native.ts` - `passkeysAvailable()` gate (mirrors railgun/native.ts) so the UI degrades
  to "needs the new app build" until the APK with `react-native-passkeys` ships.

Keep it low-LOC: the pure config/derivation rules go in `@stage-labs/client/zerodev/*` (mirroring how
accounts rules already live in the SDK), the app modules are thin IO/native wrappers.

---

## (b) Onboarding flow + the SDK call at each step

Entry: AccountsManager "Add account" sheet gets a new option **"Smart wallet (gasless)"** next to the
existing Generate / Import / WalletConnect. Screens (reuse `app/wallet/wallet.form.tsx` styling,
minimal new UI):

### Screen 1 - Create
Copy: "A gasless smart wallet on Base, secured by a passkey on this device with a recovery phrase
backup." One primary button "Create with passkey".

1. Gate: `passkeysAvailable()` (from `lib/zerodev/native.ts`); if the running binary lacks
   `react-native-passkeys`, show the "needs the new app build" state (same pattern as Private/Railgun).
2. Derive the BACKUP owner key at the next HD index from the app mnemonic (see 3.2):
   `privateKeyFromMnemonic(mnemonic, index)` -> `ownerSigner = privateKeyToAccount(pk)`.
3. Register the passkey (NO server - challenge is client-generated, pubkey extracted on-device):
   ```ts
   const challenge = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))  // client random
   const cred = await passkey.create({
     challenge,
     pubKeyCredParams: [{ alg: -7, type: 'public-key' }],          // ES256 / P-256
     rp,                                                            // { id: rp.id, name }
     user: { id, name, displayName },                              // id = the Kernel-tied user handle
     authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
     ...(Platform.OS !== 'android' && { extensions: { largeBlob: { support: 'required' } } }),
   })
   // pubkey comes back IN the create() response (cred.response.publicKey, SPKI); no verify roundtrip.
   const parsed = parsePasskeyCred(cred, rp.id)                    // extracts pubX/pubY client-side
   const webAuthnKey = await toWebAuthnKey({                       // short-circuits: returns parsed as-is
     webAuthnKey: { ...parsed, signMessageCallback: signMessageWithReactNativePasskeys },
     rpID: rp.id,
   })
   ```
   `residentKey: 'required'` makes it a DISCOVERABLE credential so a new device can find it with an
   empty `allowCredentials`. `toWebAuthnKey` returns its `webAuthnKey` arg unchanged when supplied
   (verified in source: `if (webAuthnKey) return webAuthnKey`), so `passkeyServerUrl` is never read.
4. Build the two validators:
   - `passkeyValidator = await toPasskeyValidator(publicClient, { webAuthnKey, entryPoint,
     kernelVersion, validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2 })`.
   - `ownerValidator = await signerToEcdsaValidator(publicClient, { signer: ownerSigner, entryPoint,
     kernelVersion })`.
5. Create the Kernel account (counterfactual - no tx yet):
   ```ts
   const account = await createKernelAccount(publicClient, {
     plugins: { sudo: passkeyValidator, regular: ownerValidator },
     entryPoint, kernelVersion, index: BigInt(hdIndex),
   })
   ```
   `account.address` is available immediately (counterfactual) -> show it, store the record, done.
   No deploy yet. (`index` makes multiple Kernels per owner deterministic - see 3.2.)
6. Persist the `smart` AccountRecord (see 3.1). Mark NOT deployed. Set active.

### Screen 2 - First transaction (lazy deploy, sponsored)
No dedicated screen; happens on the first real action (e.g. a send or an x402 pay routed through the
smart account). Build the client once:
```ts
const paymasterClient = createZeroDevPaymasterClient({ chain: base, transport: http(ZERODEV_RPC) })
const kernelClient = createKernelAccountClient({
  account, chain: base, bundlerTransport: http(ZERODEV_RPC), client: publicClient,
  paymaster: { getPaymasterData: (uo) => paymasterClient.sponsorUserOperation({ userOperation: uo }) },
  userOperation: { estimateFeesPerGas: async ({ bundlerClient }) => getUserOperationGasPrice(bundlerClient) },
})
const hash = await kernelClient.sendUserOperation({ callData: await account.encodeCalls([...]) })
await kernelClient.waitForUserOperationReceipt({ hash })
```
The Kernel deploys inside this first userOp, paid by the paymaster. Touching the passkey (Face ID /
fingerprint) is the user-visible step. After the receipt, set `record.registered = true` (= deployed).

### Screen 3 - Restore on a new device / re-login (NO server)
Two paths, both serverless. The wrinkle: `passkey.get()` returns the credential id + a signature but
NOT the public key, and `parseLoginCred` needs `xHex`/`yHex` supplied. In the example that pubkey came
from the server DB. Without a server we get the pubkey from one of:

**Path A - recovery phrase (the portable root, always works).** User enters the backup phrase ->
`deriveOwner(mnemonic, hdIndex)` -> rebuild the Kernel at the deterministic counterfactual address with
the OWNER ecdsa validator as `sudo` (no passkey needed at all to restore access). Then optionally
register a FRESH device passkey and rotate it in via one sponsored userOp. This is the canonical
new-device story and needs nothing but the phrase the user already backed up.

**Path B - synced passkey alone (no phrase typing), pubkey from largeBlob or on-chain.** The platform
passkey syncs via iCloud Keychain / Google Password Manager. To rebuild the WebAuthnKey we need the
pubkey + Kernel address, which are PUBLIC (not secret) and recoverable two ways:
  - iOS `largeBlob`: at registration we already request `largeBlob.support:'required'`; write the
    32+32-byte pubkey + the 20-byte Kernel address into the blob. It rides inside the iCloud-synced
    credential, so on the new device the first `passkey.get()` returns both the assertion AND the blob.
  - Deployed Kernel: the passkey validator stores pubX/pubY on-chain; read them from the validator for
    the Kernel address (address itself can be cached in iCloud KV / app group, or recomputed). Only
    works once the Kernel is deployed; for a still-counterfactual account use Path A or the blob.
Then: `passkey.get({ rpId, challenge: <client random>, allowCredentials: [], userVerification })` ->
`parseLoginCred(resp, xHex, yHex, rp.id)` -> `toWebAuthnKey({ webAuthnKey: {...} })` ->
`createKernelAccount({ address, plugins: { sudo: passkeyValidator } })`. Empty `allowCredentials`
relies on the discoverable (resident) credential, so no stored credId is required.

Recommendation: ship Path A first (zero new surface, reuses the mnemonic + derivation that already
exist for the backup owner). Treat the largeBlob convenience as a follow-up. Either way: no server.

---

## (c) Data / key model

### 3.1 Account record
Extend `AccountType` (in `@stage-labs/client/accounts/types`) with `'smart'`. New optional fields on
`AccountRecord` for smart accounts only:
```
type: 'smart'
address:        <counterfactual Kernel address>      // also the id
hdIndex:        number                                 // which derived owner backs it
ownerAddress:   string                                 // the derived ECDSA backup owner
passkeyCredId:  string                                 // base64url rawId, CACHE only (resident cred
                                                       // means restore can pass allowCredentials:[])
deployed:       boolean                                // reuse existing `registered` field
guardians?:     string[]                               // guardian addresses (display only)
guardianThreshold?: number
```
The Kernel address is the wallet identity. No private key for the passkey is ever stored (it lives in
the Secure Enclave). The derived owner key is NOT stored per-account; it is re-derived from the single
app mnemonic at `hdIndex` on demand (so SecureStore holds one mnemonic, not N keys).

### 3.2 Multi-account HD derivation
One BIP-39 mnemonic stored once (see 3.4). Each smart account = next `hdIndex`:
`m/44'/60'/0'/0/<hdIndex>` -> owner ECDSA signer; the same `hdIndex` is passed as `index: BigInt(n)`
to `createKernelAccount`, so address derivation is deterministic and reproducible from the phrase
alone. `@stage-labs/client/zerodev/derive.ts` owns `deriveOwner(mnemonic, hdIndex)` (pure). The
passkey can be REUSED across accounts (same `webAuthnKey` as `sudo` for several Kernels) or a FRESH
passkey registered per account - user choice on Screen 1; default = reuse the device passkey, vary the
owner index. Guardians are chosen per account (stored per record).

### 3.3 XMTP / signing interplay - SCW identity (decision changed)
The smart account IS the XMTP identity. XMTP RN SDK 5.7 supports SCW identities (ERC-1271, with
ERC-6492 wrapping while undeployed), so the Kernel address registers an inbox directly.

**Signer change.** The XMTP signer lives in `apps/app/lib/xmtp.codecs.ts`
(`signerForRecord` / `signerForAccount`). Today it returns an EOA signer:
`signerType: 'EOA'`, `getChainId: 1`, `signMessage` via the viem key. For a `smart` account it becomes:

```ts
{
  getIdentifier: () => new PublicIdentity(scwAddress, 'ETHEREUM'),
  signerType:    () => 'SCW',
  getChainId:    () => 8453n,                       // Base - identity is chain-bound here
  signMessage:   async (msg) => {
    const signature = await kernelClient.signMessage({ message: msg })  // ERC-1271 blob,
    return { signature }                                                 // 6492-wrapped when undeployed
  },
}
```

`Client.create` / `Client.build` are UNCHANGED - only the signer object differs. The signature is an
ERC-1271-verifiable blob (not an EOA ECDSA sig); `kernelClient.signMessage` auto-wraps it in an
ERC-6492 envelope while the Kernel is still counterfactual (ZeroDev co-authored 6492).

**Undeployed registration (ERC-6492).** libxmtp issue #736 (ERC-6492 support) is closed/done, so an
UNDEPLOYED Kernel can register an XMTP identity - the counterfactual / lazy-deploy story is preserved.
No deploy is forced just to get an inbox.

**Multi-account.** Each smart account (per HD index) = its own XMTP inbox, exactly like today. The
`metro://xmtp/<acct>/<conv>` scoping and per-account sqlite db carry over 1:1; `rec.address` simply
becomes the SCW (Kernel) address instead of an EOA. No structural change to multi-account.

**CAVEAT 1 - cutover, not migration.** The SCW address != the EOA address, so switching an existing
user to a smart account mints NEW inboxes at the SCW addresses. Existing EOA inbox history does NOT
migrate - this is a fresh-identity cutover. Offer a one-time "announce new address" option for existing
users (message their old contacts from the new SCW inbox) rather than promising history migration.

**CAVEAT 2 - chainId plumbing.** The SCW signer (chainId 8453) must be threaded through EVERY signing
path, not just `Client.create`. In particular `xmtp.recover.ts` (`revokeInstallations` /
`tryFreeInstallationSlot`) must use the same SCW signer, or it throws `AssociationError.ChainIdMismatch`.
The identity is chain-bound to Base 8453; never sign with a different chainId after registration.

**Recovery payoff.** Because the SCW address is stable across owner rotation (Kernel recovery swaps the
owner validator, not the address), the XMTP inbox + history SURVIVE a recovery. Existing installations
keep working; only a NEW installation created post-recovery must register via the SCW signer
(chainId 8453).

**SMOKE TEST before shipping.** Confirm that an undeployed (ERC-6492) Kernel can register against XMTP
PRODUCTION on Base. This is confirmed in code/issue (#736 closed) but NOT yet runtime-tested - run it
before relying on it.

**Touch points** (signer cutover, no other app-code change in this spec):
- `xmtp.codecs.ts` - the signer (main change: EOA -> SCW as above).
- `xmtp.recover.ts` - `Client.create` + `revokeInstallations` must use the SCW signer (chainId 8453).
- `xmtp.client.ts` - `Client.build` (unchanged API, same SCW signer).
- `accounts.ts` - `rec.address` becomes the SCW address.

### 3.4 Secure storage hardening
The mnemonic is the only secret stored. Store it with hardened options (NEW - current code uses bare
`setItemAsync`):
```ts
SecureStore.setItemAsync('wallet.mnemonic', phrase, {
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,   // iOS: not synced, not backed up
})
```
On Android `expo-secure-store` already uses the AndroidKeyStore (hardware-backed where available);
`requireAuthentication: true` gates reads behind device auth. The passkey private key never leaves the
Secure Enclave (handled entirely by `react-native-passkeys`). NOTE: `requireAuthentication: true`
prompts biometrics on every mnemonic read, so we read it only when (a) deriving a NEW account or (b)
exporting the backup phrase - never on a normal userOp (those use the passkey).

---

## (d) Guardian setup + recovery (native ZeroDev)

Verified against `zerodev-examples/guardians/recovery.ts`. Two-part design: the recovery module is
installed at (or after) creation; recovery is triggered by a guardian later.

### Install recovery (guardian validator as a `regular` plugin + recovery action)
```ts
import { createWeightedECDSAValidator, getRecoveryAction } from '@zerodev/weighted-ecdsa-validator'
import { getValidatorAddress, signerToEcdsaValidator } from '@zerodev/ecdsa-validator'

const guardianValidator = await createWeightedECDSAValidator(publicClient, {
  entryPoint, kernelVersion,
  config: { threshold: 100, signers: guardians.map(g => ({ address: g, weight: 100 / guardians.length })) },
  signers: guardians,                         // guardian EOAs / addresses
})

const account = await createKernelAccount(publicClient, {
  entryPoint, kernelVersion, index: BigInt(hdIndex),
  plugins: {
    sudo: passkeyValidator,
    regular: guardianValidator,
    action: getRecoveryAction(entryPoint.version),
  },
})
```
Threshold model: weights sum to 100, `threshold` is the required total. "M of N friends" =
each guardian weight `floor(100/N)`, `threshold = ceil(100 * M/N)`. We expose it as a simple "need M
of these N friends" picker in the UI and compute weights/threshold under the hood.

### Recovery UX (the screens)
1. **Add guardians** (in Settings -> Smart wallet -> Recovery): user enters friend addresses or ENS
   (resolve via existing `lib/ens.ts`), picks M-of-N. We build `guardianValidator` and, on the next
   userOp (or immediately, sponsored), the account is created/updated with the recovery plugin. Store
   `guardians` + threshold on the record (display only).
2. **Lost device** -> on a fresh install: user picks "Recover a smart wallet", enters the wallet
   address (or finds it via the backup phrase). The app generates a NEW owner signer (new passkey or
   new derived key) and shows the user a recovery request to send to guardians (a link / the wallet
   address + new owner address).
3. **Guardian approves**: each guardian, in their own Stage app, opens the recovery request and signs.
   On-chain call (from `recovery.ts`), sent by the guardian's own kernel client, sponsored:
   ```ts
   const userOpHash = await kernelClient.sendUserOperation({
     callData: encodeFunctionData({
       abi: parseAbi(['function doRecovery(address _validator, bytes calldata _data)']),
       functionName: 'doRecovery',
       args: [getValidatorAddress(entryPoint, KERNEL_V3_1), newOwnerAddress],
     }),
   })
   await kernelClient.waitForUserOperationReceipt({ hash: userOpHash })
   ```
   When the weighted threshold of guardian signatures is met, the new owner validator is installed.
4. **Resume**: rebuild the Kernel at the same address with the new owner as `sudo`:
   ```ts
   const newAccount = await createKernelAccount(publicClient, {
     address: account.address, entryPoint, kernelVersion,
     plugins: { sudo: newOwnerValidator },
   })
   ```
   Same address, new signer. The wallet is restored.

All recovery userOps are paymaster-sponsored (gasless for both user and guardians).

---

## (e) Gasless / paymaster on Base

- One ZeroDev project (Base, chainId 8453) gives a combined Bundler + Paymaster RPC URL
  (`ZERODEV_RPC`). It is a PUBLIC client identifier like the WC projectId (not a secret); store it in
  app config `extra.zerodevRpc` (or hardcode like `WC_PROJECT_ID`). Confirm with Less whether to use
  one shared key or split bundler/paymaster URLs.
- `createZeroDevPaymasterClient({ chain: base, transport: http(ZERODEV_RPC) })` and wire
  `paymaster.getPaymasterData -> paymasterClient.sponsorUserOperation`. Every userOp (deploy, send,
  recovery) is sponsored -> the user never needs ETH on Base.
- Gas policy: configure a ZeroDev gas policy in the ZeroDev dashboard (e.g. sponsor all ops up to a
  rate limit) to cap spend. This is a dashboard setting, not code.
- x402 path: the existing EIP-3009 permit flow (`x402.pay.ts`) is independent and already gasless; the
  smart account can ALSO pay x402 by signing the permit with the owner key. No change needed there
  unless we want the smart account to be the `from` - then route through the kernel client instead.

---

## (f) Native / APK sequencing plan

This is the load-bearing caveat: `react-native-passkeys` is a NATIVE module + passkeys require hosted
domain-association files + entitlements. NONE of this works over OTA / hot-reload. Sequence:

1. **Host the association files** on a domain we control. Use `stage.box` (prod variant) and
   `metro.box` (dev variant) - both already declared in `app.config.js`.
   - iOS: `https://stage.box/.well-known/apple-app-site-association` with a `webcredentials` section:
     `{ "webcredentials": { "apps": ["<TEAMID>.box.stage"] } }` (and the existing `applinks`). Served
     as `application/json`, no redirect.
   - Android: `https://stage.box/.well-known/assetlinks.json` with the
     `get_login_creds` / `delegate_permission/common.get_login_creds` relation for package `box.stage`
     and the release signing-cert SHA-256. (We already serve assetlinks for app-link verification;
     add the credentials relation / sha if missing.)
   - Repeat for `metro.box` + `box.metro.monitor` (dev variant) so dev builds can test passkeys.
   - Set the passkey RP id to the host: `rp.id = 'stage.box'` (prod) / `'metro.box'` (dev). This must
     match the associated-domains entry exactly.
2. **app.config.js changes**:
   - iOS `associatedDomains`: add `webcredentials:${variant.host}` alongside the existing
     `applinks:${variant.host}`.
   - Add the `react-native-passkeys` dep; it autolinks. Android Credential Manager needs
     `compileSdk`/`minSdk` already satisfied (minSdk 30, compileSdk 36 - OK). Confirm no extra config
     plugin is needed (the RN example needs none beyond the associated domains).
3. **Passkey server: NOT needed (serverless).** The example repo ships a SimpleWebAuthn server, but
   it exists only because that demo verifies attestation and stores the pubkey for its login flow. A
   single-user self-custody wallet needs neither (see section (z)): the registration challenge is
   client-generated, the pubkey is extracted on-device by `parsePasskeyCred`, signing uses the userOp
   hash as the challenge via `signMessageWithReactNativePasskeys`, and new-device restore uses the
   recovery phrase (Path A) or a synced-passkey largeBlob / on-chain pubkey read (Path B). The chain
   is the relying party; there is no backend to phish or verify against. So: zero new service, nothing
   folded into the Metro daemon, no credential store.
   - RN CLIENT side uses `@zerodev/react-native-passkeys-utils` (`parsePasskeyCred`, `parseLoginCred`,
     `signMessageWithReactNativePasskeys`) + `react-native-passkeys` - the one true native dep, which
     forces prebuild + a new dev-client APK.
4. **Prebuild + NEW dev-client APK**: `expo prebuild` then `eas build --profile development` (local if
   credits are out, per the APK-delivery memo). Install on Less's device BEFORE pointing the bundler at
   this branch (native-dep/APK sequencing rule). Bump `android.versionCode` (currently 27 ->) and
   `runtimeVersion` if the native surface changes.
5. Until that APK is installed, the smart-wallet option self-gates via `passkeysAvailable()` and shows
   "needs the new app build", exactly like Railgun's Private tab does today. The JS can ship to the
   served branch safely behind that gate.

---

## (g) Effort estimate + risks

Effort (one focused worker, assuming ZeroDev project + passkey server provisioned):

- ZeroDev client + account + passkey + recovery modules (`lib/zerodev/*` + `@stage-labs/client/zerodev/*`): ~1.5 days
- AccountsManager "smart" type + onboarding screens (reuse existing sheets/form): ~1 day
- Guardian setup + recovery UX screens: ~1.5 days
- (Passkey server: REMOVED - serverless, 0 days. Was ~1 day.)
- XMTP SCW signer cutover (`xmtp.codecs.ts` signer + chainId 8453 through `xmtp.recover.ts` /
  `xmtp.client.ts` + `accounts.ts` address) + undeployed-6492 smoke test on XMTP prod (Base): ~1.5 days
- Domain association files + app.config + prebuild + APK + on-device verify: ~1 day (mostly waiting on
  builds + entitlement debugging)
- Wiring the wallet send/x402 path through the kernel client: ~0.5 day

Total ~7 days (down from ~8: the passkey server is gone), gated on the APK turnaround. JS-only parts can land behind the gate first; the SCW
signer cutover ships with (and is verified against) the same APK as the passkey native dep.

Risks / unknowns:
- **Passkey associated-domains is finicky**: iOS caches the AASA aggressively; a wrong TEAMID or
  Content-Type silently breaks passkey creation with an opaque error. Budget debug time. Test on a
  real device (passkeys never work in a simulator/dev-client without the entitlement).
- **react-native-passkeys + new arch**: example uses new arch (we're on it), but verify the lib builds
  clean under our SDK 54 / RN version. Pin a known-good version.
- **Passkey server: eliminated.** Confirmed by reading the SDK source (section (z)): registration
  challenge is client-generated, pubkey is parsed on-device, signing uses the userOp hash, restore uses
  the recovery phrase or a synced-passkey blob/on-chain read. No server, no credential store. The one
  honest residual: the synced-passkey-WITHOUT-phrase restore (Path B) needs the public pubkey from
  SOMEWHERE because `passkey.get()` omits it - solved on-device via largeBlob or on-chain, never a
  hosted backend. Phrase-based restore (Path A) needs nothing extra.
- **Recovery is multi-party + on-chain**: guardians need the Stage app + to sign userOps; the
  cross-device request handoff (how a guardian receives the recovery request) needs a transport - XMTP
  is the natural fit (send the recovery request as a Stage message). Design that handoff explicitly.
- **SCW XMTP identity (decision changed)**: the smart account is now the XMTP identity via ERC-1271 /
  ERC-6492 (XMTP RN 5.7). Two real caveats: (1) cutover not migration - new SCW inboxes, old EOA inbox
  history does not carry over; (2) chainId 8453 must be threaded through every signing path incl.
  `xmtp.recover.ts` or it throws `ChainIdMismatch`. Undeployed (6492) registration is confirmed in
  code/issue #736 but NOT runtime-tested - smoke-test against XMTP production on Base before shipping.
- **ZeroDev RPC spend**: paymaster sponsors everything; set a dashboard gas policy / rate limit so a
  griefer can't drain the project. Public RPC key = anyone could submit sponsored ops against our
  policy; scope the policy tightly.
- Bundle size: the JS @zerodev deps are mostly already on disk transitively; `react-native-passkeys`
  is the only real native weight. Low.

---

## (z) Serverless verdict (definitive, from SDK source)

Read June 2026 from the published packages: `@zerodev/react-native-passkeys-utils@5.4.2`
(`utils.ts`, `signMessageWithReactNativePasskeys.ts`), `@zerodev/webauthn-key@5.4.2`
(`toWebAuthnKey.ts`), `react-native-passkeys@0.3.1`, and the `zerodevapp/react-native-passkey-example`
client + `server/src/index.ts`.

**(a) `toWebAuthnKey` / `toPasskeyValidator` WITHOUT a `passkeyServerUrl` - YES.** First statement of
`toWebAuthnKey`: `if (webAuthnKey) { return webAuthnKey }`. When you pass a `webAuthnKey` built from
`parsePasskeyCred` it returns it verbatim and the `passkeyServerUrl` branch (the `@simplewebauthn/browser`
web flow) never executes. `parsePasskeyCred(cred, rpID)` reads `cred.response.publicKey` (the SPKI that
`passkey.create()` returns on-device), ASN.1-parses it and yields `{ pubX, pubY, authenticatorId,
authenticatorIdHash, rpID }`. Exact serverless construction:
```ts
const cred = await passkey.create({ challenge: clientRandom, pubKeyCredParams: [{alg:-7,type:'public-key'}],
  rp, user, authenticatorSelection: { residentKey:'required', userVerification:'required' } })
const webAuthnKey = await toWebAuthnKey({
  webAuthnKey: { ...parsePasskeyCred(cred, rp.id), signMessageCallback: signMessageWithReactNativePasskeys },
  rpID: rp.id,
})                                                    // no passkeyServerUrl passed, none used
const passkeyValidator = await toPasskeyValidator(publicClient, {
  webAuthnKey, entryPoint, kernelVersion, validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2 })
```
`signMessageWithReactNativePasskeys` is 100% on-device: it base64-encodes the message (the userOp hash)
as the WebAuthn challenge, calls `passkey.get()`, parses r/s and ABI-encodes the validator signature.
No server in the signing path either.

**(b) Client-generated registration challenge - YES, acceptable here.** In standard WebAuthn the
server-issued challenge + attestation verification prove "a fresh ceremony on a genuine authenticator
authorized by MY backend." A self-custody wallet has NO backend granting access: the account is defined
solely by the P-256 pubkey written into the on-chain validator, and authority is proven per-userOp by a
P-256 signature the Kernel contract verifies. We never check attestation. Security analysis:
  - Replay: irrelevant at registration (registration grants nothing; it just creates a keypair). At
    signing time the challenge IS the userOp hash, which includes the nonce, so the EntryPoint's nonce
    handling prevents replay - same guarantee as any 4337 account.
  - Phishing: classic WebAuthn phishing protection (origin binding in clientDataJSON, RP-id scoping by
    the OS) still applies because the OS enforces rp.id against the associated-domains entitlement -
    that is on-device, not server-provided. A client challenge does not weaken it.
  - The one thing we lose by skipping attestation: we cannot assert the key lives in genuine hardware.
    For a personal wallet that the user themselves provisions, that is a non-goal.
Net: no meaningful downside for this model.

**(c) New-device flow with NO server.** `passkey.get()` returns the credential id + assertion but NOT
the pubkey, and `parseLoginCred` needs `xHex`/`yHex` supplied - that gap is the ONLY thing the example
server filled (it stored + returned the pubkey on login). It is closeable without a server:
  - Path A (phrase): the mnemonic-derived owner is already a validator on the Kernel; enter the phrase,
    re-derive, rebuild at the deterministic address with the owner as `sudo`. Restores access with zero
    passkey and zero stored state. Then re-register a device passkey and rotate it in (sponsored userOp).
  - Path B (synced passkey, no typing): the pubkey is PUBLIC, so stash it where it survives reinstall -
    iOS `largeBlob` inside the iCloud-synced credential (already requesting `largeBlob.support:'required'`)
    or read pubX/pubY back from the on-chain validator of a deployed Kernel. The credential id comes from
    the discoverable-credential assertion itself (`allowCredentials: []`), so nothing about the credential
    needs storing.
What MUST be stored where for a clean zero-server login: nothing mandatory beyond the mnemonic the user
already backs up (Path A). For passwordless Path B, store the public {pubX, pubY, kernelAddress} in
largeBlob and/or rely on the deployed validator; none of it is secret. What breaks with literally no
server AND no phrase AND a still-counterfactual (never-deployed) Kernel AND no largeBlob: you can't
recover the pubkey - but that scenario is avoided by either deploying lazily on first use (pubkey then
on-chain) or writing the blob at registration. So it is not a real gap.

**(d) Final verdict: fully serverless is feasible and SOLID.** No hosted server is required at any step
(register, sign, deploy, recover, restore). The single residual need - recovering the public key on a
brand-new device that restores via synced passkey alone - is satisfiable entirely on-device (largeBlob)
or on-chain (validator storage), never by a hosted backend. Recommended: ship phrase-based restore
(Path A) first (it reuses the existing mnemonic/derivation and adds zero surface), add the largeBlob
passwordless path as a follow-up. The earlier "the server is required" claim was wrong; it is removed.

## (y) Spec review - solidity + simplifications

Findings from a critical pass, ordered by importance:

1. **Server removed (biggest simplification).** See (z). Deletes ~1 day of work, a credential store,
   and an always-on attack surface on the daemon. Net: fewer moving parts, no DB of WebAuthn creds to
   secure or migrate.
2. **Two-signer-at-creation adds avoidable complexity.** Spec installs passkey `sudo` + owner-ecdsa
   `regular` AND later a guardian `regular`. A Kernel has one `regular` slot per action; juggling
   owner-ecdsa and the guardian recovery validator in the same slot is fiddly. Simpler, still meets all
   requirements: passkey = `sudo`; the mnemonic owner is the RECOVERY/backup path (it is what Path A
   restore uses) not a co-installed runtime validator; guardians = the weighted validator + recovery
   action. The owner key still backs recovery and HD-determinism without occupying a live plugin slot.
   Fold "mnemonic owner" into the recovery story rather than a second always-on signer.
3. **Guardian griefing / threshold.** `floor(100/N)` weights + `ceil(100*M/N)` threshold can round so
   that M honest guardians fall just short (e.g. N=3 -> weight 33, threshold for 2-of-3 = 67 > 66). Fix:
   give each guardian weight 1 and set `threshold = M` integer - no rounding, no griefing edge. Also
   note recovery only ROTATES the owner; it cannot move funds mid-flight, so a single malicious guardian
   below threshold is inert. State that explicitly.
4. **Paymaster abuse.** Public RPC key means anyone can submit sponsored ops against the policy. The
   spec already flags this; make the mitigation concrete: ZeroDev gas policy scoped to (a) a per-sender
   allowlist is not possible for counterfactual addresses, so use (b) a strict global rate cap + max
   gas per op + a monthly ceiling, and monitor. Acceptable for launch; revisit if abused.
5. **Cutover (XMTP identity).** Solid but it is a one-way fresh-identity switch losing EOA inbox
   history. Keep it OPT-IN per account, never auto-migrate the user's existing EOA account. The
   "announce new address" helper is good. Do not make `smart` the default account type until the
   undeployed-6492 XMTP smoke test passes on Base prod (already called out - keep it as a hard gate).
6. **chainId plumbing (8453) is a genuine sharp edge.** Already documented well. Reinforce: centralize
   the SCW signer construction so `xmtp.codecs.ts`, `xmtp.recover.ts`, `xmtp.client.ts` all import ONE
   factory - don't hand-thread `8453n` in three places (that is how `ChainIdMismatch` regressions creep
   in). Single source of truth = separation of concerns + fewer LOC.
7. **Secure-store: don't gate the mnemonic behind biometrics if the passkey already gates signing.**
   `requireAuthentication:true` on every mnemonic read is correct, but ensure normal userOps never read
   the mnemonic (they use the passkey) - the spec says this; make it a lint/test invariant so a future
   refactor doesn't accidentally read the phrase on the hot path and double-prompt.
8. **Minor: `passkeyCredId` need not be persisted** (resident credential + `allowCredentials:[]`).
   Cache it for UX but treat it as disposable; do not build restore on it being present.

None of the above blocks the design; items 2 and 3 are the two worth changing before build.

## Recommended build order
1. ZeroDev project (Base). (No passkey server - serverless.)
2. Host AASA + assetlinks credentials sections; add `webcredentials:` to app.config; add
   `react-native-passkeys`.
3. Prebuild + dev-client APK, install on device, verify a bare passkey create/get works.
4. `lib/zerodev/*` + `@stage-labs/client/zerodev/*` behind `passkeysAvailable()` gate.
5. Onboarding (create + lazy deploy + restore).
6. XMTP SCW signer cutover in `xmtp.codecs.ts` (+ chainId 8453 through `xmtp.recover.ts` /
   `xmtp.client.ts`); smoke-test undeployed-6492 registration against XMTP prod on Base.
7. Guardian setup + recovery (XMTP handoff; inbox survives recovery thanks to the stable SCW address).
8. Route wallet send / x402 through the kernel client.
