# Sign-in with Google, Microsoft, GitHub, email or a wallet

Stage accounts can be created with a recovery phrase (the default), imported
with a phrase, a private key or a QR code, or signed in with **Google,
Microsoft, GitHub, an email code or a web3 wallet**. The social and email logins go through
[Privy](https://privy.io); a web3 wallet connects through Stage's own picker
and never touches Privy. This page says how the sign-in works and what to
configure.

Without `EXPO_PUBLIC_PRIVY_APP_ID` the social and email sign-ins do not show
and nothing from Privy loads. With it, the buttons follow the Privy
dashboard: `lib/privyLogins.ts` reads which logins are on from Privy's public
app config (`https://auth.privy.io/api/v1/apps/<app id>`, parsed by
`privyAppLogins`), so switching Google, GitHub, email or the Microsoft
provider on or off there is enough. The sign-up page shows button-shaped
placeholders until that answers, and only the wallet if it fails. The wallet
button needs no Privy app.

## The sign-up page

`/signup` offers the ways in, never a username: an **email** field (with
**Continue with email**), the social logins and **Continue with wallet**.
Email sends the code and moves to the `emailCode` step (the code, Send a new
code, Use a different email), with no redirect. The wallet picker lists the
browser wallets and WalletConnect, then **Create a new wallet** (a new
recovery phrase account: a username, a profile, then the setup claims and
publishes them with sponsored gas) and **Import a wallet** (the import page).
A build without the wallet option (store builds, or no browser wallet and no
WalletConnect) keeps **Create account** and **Or import** on the page
instead. A social, email or wallet sign-in signs in first; if that address has
no Stage name yet (`ownedStageLabel`), the **claim** step asks for one and
only claims it (free, through the names service): publishing the name's
records would cost the address gas. Settings, Sign in again for an email
account uses the same steps in a modal (`components/privy/EmailSignIn.tsx`).

## What a Privy account is

| Sign-in                          | Key                                          | Stage address        |
| -------------------------------- | -------------------------------------------- | -------------------- |
| Google, Microsoft, GitHub, email | Privy embedded wallet (kept by Privy)        | the embedded wallet  |
| Web3 wallet                      | the user's wallet (browser or WalletConnect) | the wallet's address |

The address is the XMTP identity (an EOA, like an imported private key), so a
wallet's existing Basename and XMTP inbox carry over. It is an account record
of type `privy` with `login: 'google' | 'microsoft' | 'github' | 'email' | 'wallet'`. It is **not**
a Kernel smart account: there is no recovery phrase, no Link a device, and
transactions are paid by the address itself (no sponsored gas).

Every signature goes to the wallet: the embedded wallet signs silently while
the Privy session is live, a web3 wallet asks each time. To keep background
work from prompting, the account signs one **unlock message** at sign-in
(`privyUnlockMessage`). The signature is stored device-bound
(`lib/privyUnlock.ts`) and the keys for push groups, sender filters and st.box
mail are derived from it (`signStable`), so they need no further signature.
Real signatures (XMTP registration, transactions, mail sessions, username
claims) always go to the wallet.

A web3 wallet sign-in asks for two signatures: the unlock message and the
XMTP registration.

### The wallet picker

`components/wallets/WalletPicker.tsx` is Stage's own sheet (a kit `AppModal`,
mounted once in `app/_layout.tsx`), driven by `lib/walletPicker.ts`:

- **Browser wallets** come from EIP-6963 announcements
  (`lib/injectedWallets.web.ts`: name, `data:` image icon and provider; a
  plain `window.ethereum` shows as "Browser wallet" when nothing announces).
  Phones and the desktop app have none.
- **WalletConnect** (only with `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID`) shows
  our QR code, plus Open wallet app on phones. `lib/walletConnect.core.ts`
  holds the session logic; the `walletConnect(.web).ts` seams differ only in
  the React Native polyfills and in opening the wallet app on each request.
  It is loaded with a dynamic import, so its 360 KB stay out of the startup
  bundle. When it is the only option, the picker goes straight to the QR code.

`lib/externalWallet.ts` connects the picked wallet, remembers which connector
an address used (`wallet.connector.<address>` in app storage) and reconnects
on demand: silently with `eth_accounts` for a browser wallet, by restoring the
session for WalletConnect, and otherwise by opening the picker with "Connect
0x… to continue". Log out ends the WalletConnect session or revokes the
browser wallet's permission.

Sign-in never waits for message history. A wallet that is already on XMTP
often has installations from other apps or old sessions that never answer, so
the sign-in finishes once messaging is set up and `runHistorySync` runs in the
background: it returns `nothing` at once when the inbox has no other
installation, and otherwise imports an archive if one arrives within its
2-minute window (Settings, Devices and history shows how it went).

## Where the code is

- `packages/client/src/accounts/privy.ts`: account record, unlock message,
  derived signatures.
- `apps/stage/lib/signIn.ts`: `signInSession(method)`, the one entry for every
  method: a wallet goes to `lib/externalWallet.ts`, email to `lib/emailSignIn.ts`
  (our modal, `components/privy/EmailSignIn.tsx`: address, then the 6-digit
  code, through `privySendEmailCode`/`privyLoginWithEmail`), Google and
  Microsoft to `lib/privyBridge.ts` (`privyLogin`, `privyProvider`, `privyForget`), which
  mounts the Privy host on first use.
- `apps/stage/lib/privySigner.ts`, `lib/eoaSigner.ts`: viem wallet client over
  the wallet's EIP-1193 provider, shared with imported keys.
- `apps/stage/components/privy/`: the Privy host for Google and Microsoft. The
  web uses `@privy-io/react-auth`, phones use `@privy-io/expo`. The
  controllers (`webController.ts`, `nativeController.ts`) hold the logic and
  are unit-tested with fakes.

### The web runtime is a separate bundle

`@privy-io/react-auth` must never be imported from the app (Metro) graph: its
300 lazy chunks share code that Expo puts in a `__common` chunk loaded at
startup (3 MB for every visitor). `scripts/build-privy-runtime.js` builds
`components/privy/standalone.web.tsx` with Bun into `public/privy/` (not
committed), and `PrivyRuntime.web.tsx` loads `/privy/runtime.js` with a script
tag on first use. The runtime has its own React root and talks to the app only
through `PrivyRuntimeHost`. The `start`, `web`, `build:web` and desktop export
scripts build it.

stage.box is cross-origin isolated (COEP), and Privy's wallet iframe sends no
COEP header, so the browser refuses to load it. `lib/credentiallessFrames.web.ts`
wraps `document.createElement` once the Privy runtime or WalletConnect loads
(WalletConnect's domain check frame needs it too), so every iframe is
created `credentialless` (the attribute only works when it is set before the
frame first loads; the app has no other frames). A credentialless frame gets
fresh storage on every page load, which is why the Privy app must use TEE
execution, the default. Browsers without that attribute (Firefox, Safari when
isolated) only get the wallet sign-in. The CSP in `netlify.toml` allows the
Privy frame, the WalletConnect domain check frame and the WalletConnect
relay. If you turn on
bot protection in Privy, add `https://challenges.cloudflare.com` to
`script-src` and `frame-src` there.

### Redirects

- **Web:** Google and Microsoft leave the page and come back with
  `privy_oauth_*` in the query. A marker in app storage remembers the attempt,
  and onboarding resumes when the page loads again.
- **Desktop:** Google and Microsoft are off for now. Privy accepts only
  `http`, `https`, `chrome-extension` and a few app schemes as allowed
  origins, and refuses the desktop app's `stage-app://stage.box` (Nov 2026),
  so `loginMethodsFor` hides them when `window.stageDesktop` is set. The
  wallet sign-in works there through WalletConnect. The return path is built
  for when that changes: the sign-in opens in the system browser and returns
  to `https://stage.box/oauth.html`, which opens `stage://oauth?...`; the
  shell reloads the window with that query and onboarding resumes. Turning it
  on needs Privy to accept the scheme, or the desktop app to move to an
  `https://stage.box` origin, which needs a migration of its local storage
  (accounts, keys and the XMTP database are kept per origin).
- **Phones:** `@privy-io/expo` opens an in-app browser and returns to the
  `stage://` scheme. `app/+native-intent.ts` drops that return link for the
  router, so the onboarding screen stays where it is.

## Set up

1. Create the app at <https://dashboard.privy.io> and copy its **App ID**.
2. **Login methods** (User management, Authentication): turn on **Email**,
   **Google** and **GitHub** (Socials). Email needs nothing else: Privy sends
   the code from its own address (a custom sender is an Enterprise feature). For production add your own OAuth credentials
   there: Google at <https://console.cloud.google.com/auth/clients>, GitHub at
   <https://github.com/settings/applications/new>, both with the callback
   `https://auth.privy.io/api/v1/oauth/callback`. External wallets can stay
   off: Stage connects wallets itself.
3. **Microsoft** is not built into Privy: it is a custom provider, and custom
   providers need Privy's paid Scale plan once the app is in production. On
   the Free plan, keep the provider switched off (stage.box does) and the
   button stays hidden. It is set up as a custom provider (Authentication,
   **Add custom provider** at the bottom of the page) whose name contains
   `microsoft` (the app uses that provider, `custom:microsoft` here), and the
   button shows while it is switched on. Register an app at
   <https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade>
   for personal and work accounts, with the Web redirect URI
   `https://auth.privy.io/api/v1/oauth/callback`, then
   enter its client id and secret value (not the secret id), authorization URL
   `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`, token URL
   `https://login.microsoftonline.com/common/oauth2/v2.0/token`, JWKS URL
   `https://login.microsoftonline.com/common/discovery/v2.0/keys` (required),
   scopes `openid`, `email` and `profile`, PKCE on, user info source
   **Profile Endpoint** with the profile URL
   `https://graph.microsoft.com/oidc/userinfo` and the paths `name`, `email`
   and `email`. Do not pick **ID Token** as the user info source: Privy refuses
   Microsoft's key set at sign-in ("Invalid JWKS URI document"). Upload a provider
   icon (the four-square Microsoft logo): without one, Save quietly does
   nothing. Privy does not let you edit a provider: open its row and Delete it
   (possible while no user signed in with it), then add it again.
4. **Embedded wallets**: Ethereum on, wallet confirmation prompts off (the
   app also passes `showWalletUIs: false`), and the execution environment left
   on **TEE** (Wallet, Advanced). On-device execution keeps a key share in the
   iframe's storage, which the web app can not keep (see above).
5. **Allowed origins** (App settings, Domains and clients):
   `https://stage.box`, `https://dev.stage.box` and `http://localhost:8080`.
   Leave HttpOnly cookies off (it needs a Privy subdomain on stage.box).
6. **Allowed OAuth redirect URLs** (App settings, Advanced): leave empty, or
   list `https://stage.box/oauth.html` and the exact page URLs you allow.
7. **App clients** (App settings, Clients): one for iOS and Android with the
   bundle id, the package name and the URL scheme `stage`.
8. For WalletConnect (phones, the desktop app, and wallets that are not in
   the browser), create a project at <https://cloud.reown.com> and copy its
   **Project ID**. Add `stage.box`, `dev.stage.box` and `localhost` to its
   allowed domains.
9. Set the variables in Netlify (web) and in the EAS profiles (mobile):
   `EXPO_PUBLIC_PRIVY_APP_ID`, optionally
   `EXPO_PUBLIC_PRIVY_CLIENT_ID` and `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID`.

Phones need a new native build: the sign-in adds `expo-web-browser`,
`react-native-webview`, `react-native-quick-crypto` (with nitro modules and
quick-base64), `@react-native-community/netinfo` and
`@walletconnect/react-native-compat`. `react-native-passkeys` and
`@privy-io/expo-native-extensions` are peers Stage does not use and are
excluded from autolinking in `apps/stage/package.json`.

## Limits

- Deleting an account in the app does not delete the Privy user. The privacy
  policy says to email us for that.
- One Privy session at a time: signing in to a second Google or Microsoft
  account signs the first one out of Privy, and its next signature asks to
  sign in again (Settings, Security).
- One WalletConnect session at a time.
- Gas is paid by the address, like an imported key: claiming a username is
  free, but making it the primary name (Settings, Profile) and every wallet
  transaction need a little ETH on Base.
- Smart contract wallets can not sign in (the unlock signature must come from
  the address itself).
- App Store guideline 4.8 expects Sign in with Apple wherever an app offers
  Google sign-in on iOS. It is not built: Privy supports `apple`, but the
  native flow needs `expo-apple-authentication`.
