export interface ShareDestination {
  convId: string;
  title: string;
  peerAddress: string | null;
  avatarUri: string | null;
  lastBubbleTs: number | null;
}

export function acceptedShareConsent(group: boolean, hidden: boolean | undefined, consent: string | null): boolean {
  if (hidden === true) return false;
  return group && hidden !== undefined ? true : consent === 'allowed';
}
