
import type { ComputedRef, Ref } from 'vue';
import { xmtpReact } from './xmtpSend';
import type { HistoryEntry } from './types';

export interface BubbleActionsDeps {
  convId: ComputedRef<string>;
  line: ComputedRef<string | null>;
  myUri: ComputedRef<string>;
  actionTarget: Ref<HistoryEntry | null>;
  replyingTo: Ref<{ id: string; preview: string } | null>;
  optimistic: Ref<HistoryEntry[]>;
}

export interface BubbleActions {
  previewOf: (e: HistoryEntry) => string;
  onReact: (messageId: string, emoji: string) => void;
  onOptimistic: (payload: { localId: string; text: string; replyTo?: string }) => void;
  onSent: (localId: string) => void;
  onActionReply: () => void;
  onBubbleReply: (entry: HistoryEntry) => void;
  onActionCopy: () => void;
  onActionCopyLink: () => void;
}

export function useBubbleActions(deps: BubbleActionsDeps): BubbleActions {
  const { convId, line, myUri, actionTarget, replyingTo, optimistic } = deps;

  function previewOf(e: HistoryEntry): string {
    if (e.text) return e.text.slice(0, 80);
    const att = (e.payload as { attachments?: { kind: string }[] } | undefined)?.attachments?.[0]?.kind;
    return `[${att ?? 'attachment'}]`;
  }

  function onReact(messageId: string, emoji: string): void {
    if (!line.value) return;
    void xmtpReact(line.value, messageId, emoji).catch(() => undefined);
    actionTarget.value = null;
  }

  function onOptimistic(payload: { localId: string; text: string; replyTo?: string }): void {
    optimistic.value = [...optimistic.value, {
      id: payload.localId,
      ts: new Date().toISOString(),
      station: 'xmtp',
      line: line.value ?? '',
      from: myUri.value,
      to: line.value ?? '',
      text: payload.text,
      pending: true,
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
    }];
  }

  function onSent(localId: string): void {
    optimistic.value = optimistic.value.map(o => (o.id === localId ? { ...o, pending: false } : o));
  }

  function onActionReply(): void {
    if (actionTarget.value) replyingTo.value = { id: actionTarget.value.id, preview: previewOf(actionTarget.value) };
    actionTarget.value = null;
  }

  function onBubbleReply(entry: HistoryEntry): void {
    replyingTo.value = { id: entry.id, preview: previewOf(entry) };
  }

  function onActionCopy(): void {
    const t = actionTarget.value?.text;
    if (t && navigator.clipboard) void navigator.clipboard.writeText(t);
    actionTarget.value = null;
  }

  function onActionCopyLink(): void {
    const msg = actionTarget.value;
    if (msg && navigator.clipboard) {
      void navigator.clipboard.writeText(`https://metro.box/#/xmtp/${convId.value}?m=${msg.id}`);
    }
    actionTarget.value = null;
  }

  return {
    previewOf, onReact, onOptimistic, onSent, onActionReply,
    onBubbleReply, onActionCopy, onActionCopyLink,
  };
}
