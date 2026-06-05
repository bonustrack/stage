# Metro Privacy Policy

_Last updated: 5 June 2026_

Metro ("the app", "we", "us") is a wallet-native, end-to-end encrypted messenger
built on the XMTP protocol. This policy explains what data the app handles, how,
and why. We designed Metro to collect as little as possible.

## Summary

- We do not sell your data.
- We do not show ads.
- Your messages are end-to-end encrypted via XMTP. Our servers cannot read them.
- We do not ask for your name, email, or phone number to use the app.

## What data the app handles

**Wallet address (public key).** When you sign in with your Ethereum wallet, your
public wallet address becomes your identity on the XMTP network. It is visible to
people you message, the same way a username is. We do not collect your private
keys — they stay in your wallet/on your device.

**Messages and message content.** Conversations (text, images, voice messages,
reactions, and shared location, when you choose to send it) are transmitted over
the XMTP network and are end-to-end encrypted. Encryption keys are held on your
device; neither Metro's operators nor the XMTP network can read your message
content.

**Push notification token.** If you enable notifications, your device's push
token (from Firebase Cloud Messaging) is stored by our notification service so we
can deliver alerts about new messages. Notifications are contentless by default —
they signal that a message arrived without exposing its contents.

**Optional device permissions.** With your explicit consent, the app may access
your camera, photo library, microphone, and location — solely to let you send
that content in a conversation. This data is sent only to the recipients you
choose and is not collected by us.

**Local app data.** Conversation history and settings are stored locally on your
device (and within the encrypted XMTP network). Uninstalling the app removes the
local copy.

## How we use data

- To operate the messenger: route encrypted messages over XMTP between you and
  your contacts.
- To deliver push notifications you have opted into.
- We do not use your data for advertising or profiling, and we do not sell or
  rent it to third parties.

## Third parties

- **XMTP network** — the open, decentralized protocol that carries your encrypted
  messages.
- **Firebase Cloud Messaging (Google)** — delivers push notifications to your
  device. Subject to Google's privacy policy.

We share data with these services only to the extent required to deliver the
features above. We do not sell data to anyone.

## Data security

Messages are end-to-end encrypted in transit and at rest within the XMTP network.
Network traffic uses encrypted (TLS/HTTPS) connections.

## Data retention and deletion

Message content lives in the encrypted XMTP network and on your device. Removing
the app deletes the local copy. To request deletion of your push token from our
notification service, contact us at the address below.

## Children

Metro is not directed to children under 13 and we do not knowingly collect data
from them.

## Changes

We may update this policy; the "last updated" date will change accordingly.

## Contact

Questions or requests: tony@bonustrack.co

---

## HOSTING NOTE (for Less — not part of the published text)

Google Play REQUIRES a publicly reachable privacy-policy URL on the listing.
This Markdown must be hosted as a public web page, e.g. **https://metro.box/privacy**,
and that exact URL entered in Play Console → Store presence → Main store listing,
and in App content → Privacy policy. metro.box is already a Netlify site, so add a
`/privacy` route/page (render this content) and `curl https://metro.box/privacy`
to confirm 200 before submitting (per the Netlify-deploy memory).
