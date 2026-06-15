# Wallet key security

All private-key and mnemonic access in this app flows through ONE enforced,
auditable chokepoint: [`lib/zerodev/keyring.ts`](./lib/zerodev/keyring.ts).

## The single chokepoint

The keyring is the only module that:

- reads or writes the single BIP-39 app mnemonic (root of every smart account +
  agent), stored hardened (`requireAuthentication: true` +
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY`);
- reads or writes the per-account raw secp256k1 private keys (generated /
  imported EOAs), under the `wallet.pk.<id>` secure-store keys;
- imports the secret-bearing primitives:
  - `deriveOwner` / `generateWalletMnemonic` from
    `@stage-labs/client/zerodev/derive`,
  - the `PK_PREFIX` / `LEGACY_PK_KEY` storage-key constants from
    `@stage-labs/client/accounts/keys`,
  - `privateKeyToAccount` / `generatePrivateKey` / `mnemonicToAccount` from
    `viem/accounts`.

No other file in the app may touch any of the above.

## Guarantees

1. **Key never leaves.** Signing happens inside the keyring. Its public API
   returns signatures or an opaque viem/XMTP signer object (an `HDAccount` /
   `PrivateKeyAccount` can sign but exposes no key extractor). It never returns
   the raw 32-byte key or the mnemonic string, except via the two guarded
   reveals below.
2. **Sign-in-place only.** A key is read only at an actual sign; the mnemonic is
   read only when deriving a new account or at a reveal. Nothing reads a key or
   prompts biometrics on app open, balance view, or wallet creation.
3. **One guarded reveal each.**
   - `revealRecoveryPhrase()` returns the mnemonic for the backup screen. It is
     biometric-gated by construction: the mnemonic is stored
     `requireAuthentication: true`, so the OS prompts biometrics/passcode on the
     read (no extra native dep needed).
   - `revealPrivateKey(id)` returns one EOA's raw key for the explicit
     "Export private key" action, which the UI gates behind a destructive
     warning Alert.
   Both never log key material; nothing else returns secrets.

## Everyday / view path needs no key, no biometric

Opening the app, listing accounts, and showing balances use only public
addresses from the account registry. They never call the keyring's secret
accessors, so there is no key read and no biometric prompt on the hot path.
The derived key signs normal txs (auth only at sign time); the optional passkey
is invoked only when signing a tx/message, never on app open or wallet creation.

## How the chokepoint is enforced

Two independent mechanisms make a leak fail before it can ship:

1. **Lint (build-failing).** A custom ESLint rule `metro/no-keyring-bypass`
   (see [`eslint.config.mjs`](./eslint.config.mjs)) errors if any file other than
   `lib/zerodev/keyring.ts` imports the banned primitives / storage-key
   constants. The rule runs over `lib/`, `app/`, `components/`, and `modules/`,
   so a bypass cannot even compile through `bun run lint`.
2. **Test invariant.** [`test/keyring.guard.test.ts`](./test/keyring.guard.test.ts)
   scans the same source trees and asserts the keyring is the sole importer,
   failing CI on any bypass — defense in depth alongside the lint rule.

To audit: read `lib/zerodev/keyring.ts` (the whole secret surface) and the two
guards above. Nothing else in the app can reach the key material.
