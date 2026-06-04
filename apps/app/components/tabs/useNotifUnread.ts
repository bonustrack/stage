/** Notification-specific unread count, derived from pending message requests +
 *  the device-local read-state store (lib/notifReadState).
 *
 *  Distinct from the channels-tab unread counter: this counts how many message
 *  requests the user has NOT yet seen on the Notifications page. Re-derives when
 *  the request set changes or when read-state flips (mark-as-read on open).
 *
 *  Returns just the number so a tab badge / header pill can consume it without
 *  pulling in the full request previews. */

import { useEffect, useState } from 'react';
import { useRequestPreviews } from './useRequestPreviews';
import { loadNotifReadState, unreadCount, subscribeNotifReadState } from '../../lib/notifReadState';

/** Live count of unread notifications (= pending requests not yet marked read). */
export function useNotifUnread(): number {
  const { previews } = useRequestPreviews();
  const ids = previews.map(p => p.convId);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const recompute = (): void => { if (alive) setCount(unreadCount(ids)); };
    void loadNotifReadState().then(recompute);
    const unsub = subscribeNotifReadState(recompute);
    return () => { alive = false; unsub(); };
    // ids is rebuilt each render; join into a stable dep so we only recompute
    // when the actual set of pending request ids changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  return count;
}
