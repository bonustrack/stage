# Google Play Data Safety form — answers for Less to enter

Play Console → App content → Data safety. Enter the following.

## Overview answers
- Does your app collect or share any required user data types? **YES**
  (push token + wallet address are handled by the app/services.)
- Is all user data encrypted in transit? **YES** (TLS/HTTPS + XMTP E2E).
- Do you provide a way for users to request data deletion? **YES** — via email
  (tony@bonustrack.co) for push-token deletion; uninstall removes local data.

## Data types — declare these

### 1. Personal info → "Other IDs" (wallet address / public key)
- Collected: **Yes**  | Shared: **Yes** (visible to message recipients via XMTP)
- Processed ephemerally: No
- Required (not optional): Yes
- Purpose: **App functionality** (it is the user's messaging identity)
- Note: wallet PRIVATE keys are NOT collected (they remain in the user's wallet).

### 2. Messages → "Other in-app messages"
- Collected: **No** for our servers — messages are end-to-end encrypted and we
  cannot read them. Play guidance: if content only transits E2E-encrypted and you
  cannot access it, you may declare it as not collected by you. Declare as
  **not collected** (E2E encrypted; operator has no access). Mention E2E in the
  listing/policy.

### 3. App activity / Device IDs → Push notification token (FCM)
- Collected: **Yes**  | Shared: **Yes** (with Google Firebase to deliver pushes)
- Processed ephemerally: No
- Required: No (only if user enables notifications)
- Purpose: **App functionality** (deliver message notifications)

### 4. Photos / Videos, Audio (voice), Location — ONLY when user sends them
- These are accessed on-device with explicit permission and sent to chosen
  recipients over E2E-encrypted XMTP. They are **not collected by us**.
- If Play's wizard insists on declaration because permissions are requested:
  declare each as **Shared: Yes / Collected: No**, purpose **App functionality**,
  optional, and note E2E encryption + user-initiated only.

## Security practices section
- Data is encrypted in transit: **Yes**
- Users can request data deletion: **Yes**
- Committed to Play Families Policy: **No** (not a kids app)
- Independent security review: **No** (unless Less has one)

## Quick checklist
- [ ] Wallet address (Other IDs): collected+shared, app functionality, required
- [ ] Push token (Device/Other IDs): collected+shared w/ Firebase, app functionality, optional
- [ ] Messages: not collected (E2E encrypted)
- [ ] Photos/Audio/Location: not collected by us; user-initiated, E2E
- [ ] Encrypted in transit: Yes
- [ ] Data deletion available: Yes (email + uninstall)
- [ ] Privacy policy URL entered: https://metro.box/privacy
