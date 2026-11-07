# Wallet key security

All private-key and mnemonic access in this app flows through ONE enforced,
auditable chokepoint: [`lib/zerodev/keyring.ts`](./lib/zerodev/keyring.ts).

## The single chokepoint

The keyring is the only module that:

- reads or writes each BIP-39 recovery phrase used by smart accounts. Native
  storage stays device-bound (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Phrase reads
  use `STORE_OPTS`, without `requireAuthentication`. The authenticated native
  device sentinel is a separate export guard, not a decryption key;
- reads or writes the per-account raw secp256k1 private keys (generated /
  imported EOAs), under the `wallet.pk.<id>` secure-store keys;
- names the secret secure-store keys: `PK_PREFIX` (`wallet.pk.`),
  `LEGACY_PK_KEY` (`wallet.privateKey`) and the `wallet.mnemonic` phrase keys
  are private constants of the keyring, exported by no module;
- imports the secret-bearing primitives:
  - `deriveOwner` / `generateWalletMnemonic` from
    `@stage-labs/client/zerodev/derive`,
  - `privateKeyToAccount` / `generatePrivateKey` / `mnemonicToAccount` /
    `hdKeyToAccount` from `viem/accounts`.

No other file in the app may touch any of the above.

## Guarantees

1. **Key never leaves.** Signing happens inside the keyring. Its public API
   returns signatures or an opaque viem/XMTP signer object (an `HDAccount` /
   `PrivateKeyAccount` can sign but exposes no key extractor). It never returns
   the raw 32-byte key or the mnemonic string, except via the explicit reveal
   APIs below.
2. **Sign-in-place only.** A key is read only at an actual sign; the mnemonic is
   read only when deriving a new account or at a reveal. Nothing reads a key or
   prompts biometrics on app open, balance view, or wallet creation.
3. **Explicit reveal paths.**
   - `revealActiveRecoveryPhrase(expectedAccountId)` displays only the active
     smart account's phrase, without another device-auth prompt. It
     checks the active account before and after reading. Settings keeps the
     screen warning, Hide and show-mode auto-hide. Switching accounts clears
     the displayed phrase.
   - `revealRecoveryPhrase()` keeps native device authentication for Link a
     device. It is not the Settings display path.
   - `revealPrivateKey(id)` keeps native device authentication for the
     explicit "Export private key" action and its destructive UI warning.
     These APIs never log key material. Storage, signing and other sensitive
     actions are unchanged.

## Everyday / view path needs no key, no biometric

Opening the app, listing accounts, and showing balances use only public
addresses from the account registry. They never call the keyring's secret
accessors, so there is no key read and no biometric prompt on the hot path.
The recovery-phrase ECDSA owner signs smart-account messages and transactions.
Native device authentication is reserved for explicit key export and device
transfer, not wallet signing. On web, `platform/storage.web.ts` uses localStorage
for wallet secrets and does not enforce device authentication or encrypt them.

## How the chokepoint is enforced

Two independent mechanisms make a leak fail before it can ship:

1. **Lint (build-failing).** A custom lint rule `stage/no-keyring-bypass`
   (see [`oxlint-plugin.mjs`](./oxlint-plugin.mjs)) errors if any file other than
   `lib/zerodev/keyring.ts` imports the banned primitives, imports anything
   named `PK_PREFIX` or `LEGACY_PK_KEY` from any module, or writes a string
   that starts with a secret storage key name (`wallet.pk.`,
   `wallet.privateKey`, `wallet.mnemonic`). The rule runs over `app/`,
   `components/`, `lib/`, `modules/` and `platform/`, so a bypass cannot pass
   `bun run lint`.
2. **No exported key names.** The storage key names live only inside the
   keyring module, so there is nothing to import: `@stage-labs/client` holds no
   secret storage key names.

To audit: read `lib/zerodev/keyring.ts` (the whole secret surface) and the lint
rule above. Nothing else in the app can reach the key material.
