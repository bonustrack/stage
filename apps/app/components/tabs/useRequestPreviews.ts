/** Pending message-requests preview source for the Notifications card.
 *
 *  Mirrors the channels-tab topnav counter: pending convs are those whose XMTP
 *  consent is 'unknown' (listRequestConvs). On top of the raw count we resolve a
 *  lightweight avatar descriptor per requester (DM peer address, or a group's
 *  uploaded image / channel-id stamp seed) so the card can render a stacked
 *  avatar pile. Re-syncs on mount, on consent stream ticks (accept/block on this
 *  or another device), and on foreground resume. */

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { Conversation } from '@xmtp/react-native-sdk';
import { listRequestConvs, streamConvConsent, peerEthAddressOfDm } from '../../modules/messaging';
import { channelStampSeed } from '@metro-labs/kit/avatar';
import { ensurePeerProfiles } from '../../lib/peerProfiles';

/** One requester's avatar descriptor — feeds the Avatar component directly. */
export interface RequestPreview {
  convId: string;
  /** DM peer / group seed eth address for the stamp.fyi identicon. */
  avatarAddress: string | null;
  /** Group-uploaded image (takes precedence over the seed). */
  avatarUri: string | null;
  isGroup: boolean;
}

async function describe(conv: Conversation): Promise<RequestPreview> {
  const peerAddress = await peerEthAddressOfDm(conv).catch(() => null);
  if (peerAddress) {
    return { convId: conv.id, avatarAddress: peerAddress, avatarUri: null, isGroup: false };
  }
  const g = conv as unknown as { imageUrl?: () => Promise<string> };
  const imageUrl = (await g.imageUrl?.().catch(() => '') ?? '').trim();
  return {
    convId: conv.id,
    avatarAddress: imageUrl ? null : channelStampSeed(conv.id),
    avatarUri: imageUrl || null,
    isGroup: true,
  };
}

export interface RequestPreviews {
  count: number;
  previews: RequestPreview[];
}

/** Live pending message-requests previews. `count` is the full pending total;
 *  `previews` holds every requester's avatar descriptor (the card caps how many
 *  it renders in the pile). */
export function useRequestPreviews(): RequestPreviews {
  const [state, setState] = useState<RequestPreviews>({ count: 0, previews: [] });

  useEffect(() => {
    let cancelled = false;
    const refresh = async (): Promise<void> => {
      try {
        const convs = await listRequestConvs();
        const previews = await Promise.all(convs.map(describe));
        if (cancelled) return;
        ensurePeerProfiles(previews.map(p => p.avatarAddress));
        setState({ count: previews.length, previews });
      } catch { /* swallow — backstops retry */ }
    };
    void refresh();
    let cancelConsent: (() => void) | null = null;
    try { cancelConsent = streamConvConsent(() => { void refresh(); }); }
    catch { /* AppState resume backstops it */ }
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return (): void => {
      cancelled = true;
      if (cancelConsent) try { cancelConsent(); } catch { /* ignore */ }
      sub.remove();
    };
  }, []);

  return state;
}
