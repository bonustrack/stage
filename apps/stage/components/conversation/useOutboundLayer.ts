import { useCallback, useEffect, useMemo, useState } from 'react';
import { patchRowSent } from '../../lib/channelsCache';
import type { HistoryEntry } from '@stage-labs/client/types';
import type { DeletedMessages } from '@stage-labs/client/xmtp/deletions';
import { isFeedBubble } from '@stage-labs/client/xmtp/visibility';
import { attachmentsPayload } from '@stage-labs/client/xmtp/entryPayload';
import { deletedViewCache } from './messageDeletion.model';
import { optimisticRowPreview, outboundView, pendingFromMe, recordSent, settleOutbound, type OutboundState } from './outboundRows.model';
import { useUploadedAttachments } from '../../lib/localAttachmentCache';
import type { OptimisticEntry } from '../composer/types';

export function useFeedBubbles(events: HistoryEntry[], myUri: string, deletedIds: DeletedMessages) {
  const [outbound, setOutbound] = useState<OutboundState>(() => ({ optimistic: [], confirmedIds: new Map() }));

  const deletedView = useMemo(deletedViewCache, []);
  const liveBubbles = useMemo(
    () =>
      events
        .filter((e) => isFeedBubble(e))
        .map((e) => {
          const by = deletedIds.get(e.id);
          return by ? deletedView(e, by) : e;
        }),
    [events, deletedIds, deletedView],
  );
  const uploaded = useUploadedAttachments();
  const view = useMemo(() => outboundView(outbound, liveBubbles, myUri, uploaded), [outbound, liveBubbles, myUri, uploaded]);
  const allBubbles = useMemo(
    () => (view.pending.length ? [...pendingFromMe(view.pending, myUri), ...liveBubbles] : liveBubbles),
    [view, liveBubbles, myUri],
  );
  useEffect(() => {
    if (view.confirmed.size) setOutbound((s) => settleOutbound(s, outboundView(s, liveBubbles, myUri, uploaded)));
  }, [view, liveBubbles, myUri, uploaded]);
  const { localIdOf } = view;
  const rowKeyOf = useCallback((e: HistoryEntry): string => localIdOf.get(e.id) ?? e.id, [localIdOf]);
  return { confirmedIds: outbound.confirmedIds, setOutbound, allBubbles, rowKeyOf };
}

export function useOutboundLayer(
  setOutbound: React.Dispatch<React.SetStateAction<OutboundState>>,
  myUri: string,
  convId: string | undefined,
  activeLine: string,
  followNewest: () => void,
) {
  const onOptimistic = useCallback(
    ({ localId, text, attachments, replyTo, payload }: OptimisticEntry) => {
      setOutbound((s) => ({
        ...s,
        optimistic: [
          {
            id: localId,
            ts: new Date().toISOString(),
            station: 'xmtp',
            line: activeLine,
            from: myUri,
            to: activeLine,
            text: text || undefined,
            ...(replyTo ? { replyTo } : {}),
            ...(payload ? { payload } : attachments.length ? { payload: attachmentsPayload(attachments) } : {}),
          },
          ...s.optimistic,
        ],
      }));
      followNewest();
      if (convId) patchRowSent(convId, optimisticRowPreview(text, attachments));
    },
    [activeLine, myUri, convId, followNewest, setOutbound],
  );

  const onSent = useCallback(
    (localId: string, _error: unknown, sentId?: string) => {
      setOutbound((s) => recordSent(s, localId, sentId));
    },
    [setOutbound],
  );

  return { onOptimistic, onSent };
}
