/** @file In-process mirror of the currently-viewed conversation id so the foreground notification path can suppress cards for the open conversation. */
// JS-side mirror of the currently-viewed conversation id.
//
// The native `setActiveConversation` (metro-pill) writes the open convId to
// SharedPreferences so the FCM process can suppress its push. That value lives
// in a native-only store the JS foreground stream can't cheaply read, so we
// ALSO mirror it here in-process: the foreground rich-notification path
// (HomeScreen.stream → presentInboundNotification) checks this to skip posting
// a card for the conversation the user is actively looking at — matching the
// native suppression. Stored lowercased so the compare is case-insensitive
// (the RN/node SDKs aren't guaranteed to agree on convId case).
//
// Cleared (null) on blur / background so the default never suppresses.
let activeConvId: string | null = null;

/** Set (or clear, with null) the conversation the user is currently viewing. */
export function setActiveConvId(convId: string | null): void {
  activeConvId = convId ? convId.toLowerCase() : null;
}

/** Whether `convId` is the conversation currently on-screen (case-insensitive). False when nothing is open — so the foreground notif fires by default. */
export function isActiveConv(convId: string | null | undefined): boolean {
  if (!convId || !activeConvId) return false;
  return convId.toLowerCase() === activeConvId;
}
