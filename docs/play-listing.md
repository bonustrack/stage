# Metro — Google Play Store listing

App entry: `box.metro.monitor` (Play Console KYC done, app entry created).
Build artifact: signed Android App Bundle (AAB) from EAS `production` profile.
Initial release track: internal → (after testing) production.

---

## Store listing

**App name (title):** Metro
_(30 char max — "Metro" = 5 chars, fine.)_

**Short description (≤80 chars):**
> Private wallet, encrypted chat, and onchain governance — all in one app.
_(72 chars)_

**Full description (≤4000 chars):**

> Metro is your private gateway to web3 — secure messaging, a self-custodial
> wallet, and onchain governance, together in one fast, native app.
>
> MESSAGING
> Chat over XMTP, the open end-to-end-encrypted messaging protocol for wallets.
> Your conversations are encrypted and portable — no phone number, no email,
> just your wallet. Send text, images, voice messages, and locations to anyone
> with a wallet address or ENS name.
>
> WALLET
> A self-custodial Ethereum wallet you fully control. View balances, tokens,
> and NFTs across networks. Your keys live on your device in secure storage —
> Metro never holds them and never can.
>
> GOVERNANCE
> Follow the DAOs you care about and vote on Snapshot proposals directly from
> your phone. Track active proposals, cast votes with your wallet, and stay on
> top of decisions that matter — wherever you are.
>
> PRIVATE BY DESIGN
> Metro is built privacy-first: messages are end-to-end encrypted, your private
> keys never leave your device, and we don't sell your data. Connect with
> WalletConnect or import an existing wallet.
>
> Metro brings messaging, money, and governance into a single, polished
> experience. Own your identity, own your conversations, own your vote.

**Category:** Communication (alt: Finance)
_Recommended: Communication — messaging is the primary surface. If Less prefers
to lead with wallet/governance, Finance also fits._

**Tags / type:** Apps (not Games).

**Contact email:** tony@bonustrack.co
**Website:** https://metro.box
**Privacy policy URL:** https://metro.box/privacy  ← MUST be hosted (see below).

**Default language:** English (United States).

---

## Data Safety form (Play Console → App content → Data safety)

Honest draft based on what the app actually handles. Confirm each before submit.

**Does your app collect or share any of the required user data types?** Yes
(it handles wallet addresses + message content, though most stays on-device /
in the E2E-encrypted protocol — Play still wants these declared).

**Is all user data encrypted in transit?** Yes (XMTP is E2E encrypted; all
network calls are HTTPS/TLS).

**Do you provide a way for users to request data deletion?** Data is
self-custodial / on-device; uninstalling removes local data. Wallet + message
identity is controlled by the user's keys, not by us. (Provide deletion contact:
tony@bonustrack.co.)

Data types — declare:

| Data type | Collected | Shared | Purpose | Notes |
|---|---|---|---|---|
| Messages (in-app, other) | Collected* | No | App functionality | E2E-encrypted via XMTP; not readable by us, transits XMTP network. |
| Wallet address / financial info (other) | Collected* | No | App functionality, Account management | Wallet address is the user's identity; used to send/receive and to vote. Private keys NEVER leave device. |
| Photos/Videos | Collected* | No | App functionality | Only when the user attaches media to a message; sent E2E. |
| Audio (voice messages) | Collected* | No | App functionality | Only when user records a voice message; sent E2E. |
| Approximate/precise location | Collected* | No | App functionality | ONLY if the user explicitly shares location in a chat. Optional. |
| App activity / interactions | Not collected | — | — | No analytics SDK shipping today; if one is added, update this. |
| Device IDs / identifiers | Collected | No | App functionality | Push token (FCM) for message notifications. |

\* "Collected" in Play's sense = leaves the device / transits a network.
Most of this is end-to-end encrypted and not readable by Metro.

**Selling data:** NO. Metro does not sell user data.
**Sharing with third parties:** No data shared for advertising/analytics.
Message + push delivery uses XMTP / Firebase Cloud Messaging as processors only.
**Data used for tracking (cross-app advertising):** NO.

---

## Privacy policy

Drafted at `docs/privacy-policy.md`. MUST be hosted at a public URL before
submission. Recommended: publish to https://metro.box/privacy (metro.box is
Less's Netlify site — drop the rendered HTML there and curl-verify the URL 200s
before pasting it into Play Console).

---

## Assets

| Asset | Required | Status |
|---|---|---|
| App icon 512×512 (32-bit PNG) | Yes | DERIVE from `apps/app/assets/icon.png` (1024×1024) — downscale to 512. |
| Feature graphic 1024×500 | Yes | NEEDED from Less (no 1024×500 asset in repo). |
| Phone screenshots (≥2, ≥320px, ≤3840px) | Yes (min 2) | NEEDED from Less — capture from device/emulator (chat, wallet, governance screens). |
| 7" / 10" tablet screenshots | Optional | Nice-to-have (app supportsTablet). |

---

## What is REQUIRED from Less to finish

1. **Google Play service-account JSON** — Play Console → Setup → API access →
   create/link a service account, grant it the "Release to testing tracks" (and
   later production) permission, download the JSON key. Save it to
   `apps/app/play-service-account.json` (already referenced in eas.json submit
   profile; gitignored — keep it out of git). REQUIRED before `eas submit`.
2. **Privacy policy hosting** — host `docs/privacy-policy.md` at
   https://metro.box/privacy and confirm it returns 200.
3. **Feature graphic** 1024×500 PNG/JPG.
4. **≥2 phone screenshots.**
5. **Confirm applicationId** `box.metro.monitor` (kept as-is) and app title "Metro".
6. **EAS credits** — account is at 100% of included build credits; the prod
   build runs at pay-as-you-go rates (a small charge). Confirm OK, or top up.

---

## Remaining steps to go live (internal track)

1. EAS prod AAB build completes (build id `1a1d1ec8-b9e2-49a7-b54f-68133592a742`).
2. Less provides the Play service-account JSON → save to
   `apps/app/play-service-account.json`.
3. Fill Play Console: store listing (above), data safety (above), privacy
   policy URL, content rating questionnaire, target audience, ads declaration
   (no ads), upload feature graphic + screenshots + 512 icon.
4. Submit the AAB to the **internal** track:
   `eas submit --platform android --profile production --latest --non-interactive`
   (uses submit.production from eas.json: track=internal, releaseStatus=draft).
   Or upload the AAB by hand in Play Console → Internal testing.
5. Add internal testers (emails) in Play Console, share the opt-in link, test.
6. When happy: promote the internal release to **production** in Play Console
   (or change the submit track to `production` and re-submit), complete any
   remaining Play review requirements, and roll out.
