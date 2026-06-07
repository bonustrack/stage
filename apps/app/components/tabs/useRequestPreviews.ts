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
import { listRequestConvs, streamConvConsent, requestAvatarDescriptor } from '../../modules/messaging';
import type { ConversationRequestView } from '../../modules/messaging';
import { ensurePeerProfiles } from '../../lib/peerProfiles';

/** One requester's avatar descriptor - feeds the Avatar component directly. The
 *  avatar fields are projected from the facade's `ConversationRequestView`. */
export type RequestPreview = Pick<
  ConversationRequestView,
  'convId' | 'avatarAddress' | 'avatarUri' | 'isGroup'
>;

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
        const previews = await Promise.all(convs.map(requestAvatarDescriptor));
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
