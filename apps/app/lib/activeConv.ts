/** @file In-process JS-side mirror of the currently-viewed conversation id so the foreground notification path can suppress cards for the open conversation. */

/** Mirrors the native SharedPreferences active-conv value in-process (lowercased, case-insensitive) so the foreground rich-notification path skips posting a card for the conversation the user is viewing. */

/** Cleared (null) on blur / background so the default never suppresses. */
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
