import type { ResolveConvError } from '../../lib/messaging/resolveConversation';

export function resolveErrorMessage(error: ResolveConvError, detail?: string): string {
  if (error === 'unregistered') return 'This address is not on XMTP yet. Ask them to sign in once, then retry.';
  if (error === 'stale-installations')
    return 'This contact has not used XMTP in a while, so their keys expired. They need to open an XMTP app before you can message them.';
  if (error === 'failed') return detail ? `Could not open this conversation. ${detail}` : 'Could not open this conversation.';
  return 'Missing conversation id.';
}
