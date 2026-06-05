# Stage — Google Play Data Safety form (draft)

This maps the app's behavior to the Play Console Data Safety questionnaire.
Verify each answer against the shipped build before submitting.

## Summary stance
- Stage is a self-custody, end-to-end encrypted messenger. Private keys and
  message decryption happen on-device.
- Messages are E2E encrypted via XMTP; Stage operators cannot read content.
- There is no Stage-operated account/identity backend: identity = the user's
  Ethereum wallet.

## Data collection & sharing — top-level
- Does your app collect or share any of the required user data types? YES
  (some data is collected/processed; see below). Most is processed on-device,
  but the questionnaire counts data sent off-device, e.g. to XMTP network
  nodes and the push pipeline.
- Is all collected data encrypted in transit? YES (XMTP transport is
  encrypted; network/API calls use HTTPS).
- Do you provide a way for users to request data deletion? Identity is the
  user's wallet; uninstalling removes on-device keys/data. Provide deletion
  contact: tony@bonustrack.co.

## Data types

### Personal info
- Other identifiers — Ethereum wallet address / ENS name.
  - Collected: YES (used as the user's identity and message routing address).
  - Shared: YES (an address is inherently visible to message recipients and
    published to the XMTP network to route messages).
  - Processing: required for the app to function (messaging).
  - Optional: NO (the app requires a wallet to operate).

### Messages
- Other in-app messages — chat content, images, voice messages, location
  shared in chat.
  - Collected: YES (transmitted via XMTP to deliver to recipients).
  - Shared: NO third-party sharing for ads/analytics. Content is end-to-end
    encrypted; XMTP nodes relay ciphertext only.
  - Encrypted in transit: YES. End-to-end encrypted: YES.
  - Processing: required for app functionality (delivering messages).

### Photos and videos
- Photos — only when the user attaches an image/voice/photo to a message.
  - Collected: YES (only the items the user chooses to send).
  - Shared: sent E2E-encrypted to the chosen recipients only.
  - Optional: YES (only on user action).

### Audio
- Voice or sound recordings — voice messages the user records and sends.
  - Collected: YES, on user action. E2E encrypted. Optional: YES.

### Location
- Approximate / precise location — only when the user explicitly shares
  location in a chat.
  - Collected: YES, on user action. E2E encrypted to recipients. Optional: YES.

### App activity / Device or other IDs
- Push notification token — registered with the push pipeline to deliver new
  message alerts.
  - Collected: YES (device push token).
  - Purpose: app functionality (notifications). Not used for ads.
  - Note: notification content design is privacy-preserving (contentless /
    on-device decrypt) — message bodies are not sent to third-party push
    servers in plaintext.

## Data NOT collected
- No name, email address, or phone number (no traditional account).
- No financial info collected by Stage operators (self-custody; keys on-device;
  Stage has no custody and no server-side wallet data).
- No advertising / no third-party analytics SDKs for ads.
- No browsing history, no contacts upload, no health/fitness data.

## Security practices
- Data encrypted in transit: YES.
- Private keys stored on-device using platform secure storage
  (expo-secure-store / Android Keystore).
- Users can request deletion: YES — uninstall wipes local data; contact
  tony@bonustrack.co for any operator-side requests.

## Notes for the reviewer
Stage is built on open protocols (XMTP for messaging, Ethereum for identity).
The operator runs no message-content database; relays carry only end-to-end
encrypted payloads.
