
import { ref, nextTick } from 'vue';
import { computeMentionQuery, applyMention, type MentionCandidate } from '@stage-labs/client/xmtp/mentions';

export function useComposerMentions(
  getTextarea: () => HTMLTextAreaElement | null,
  getCandidates: () => MentionCandidate[] | undefined,
  setText: (next: string) => void,
  afterPick: () => void,
) {
  const matches = ref<MentionCandidate[]>([]);
  const range = ref<{ start: number; end: number } | null>(null);
  const active = ref(0);

  function refresh(): void {
    const el = getTextarea();
    if (!el) { range.value = null; return; }
    const res = computeMentionQuery(el.value, el.selectionStart, getCandidates());
    matches.value = res.matches;
    range.value = res.matches.length > 0 ? res.range : null;
    if (active.value >= res.matches.length) active.value = 0;
  }

  function pick(c: MentionCandidate): void {
    const r = range.value;
    const el = getTextarea();
    if (!r || !el) return;
    const { next, cursor } = applyMention(el.value, r, c.address);
    setText(next);
    range.value = null;
    void nextTick(() => {
      const e = getTextarea();
      if (e) { e.focus(); e.setSelectionRange(cursor, cursor); }
      afterPick();
    });
  }

  function move(delta: number): void {
    const n = matches.value.length;
    active.value = (active.value + delta + n) % n;
  }

  function onKeydown(ev: KeyboardEvent): boolean {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); move(1); return true; }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); move(-1); return true; }
    if (ev.key === 'Enter' || ev.key === 'Tab') {
      ev.preventDefault();
      const p = matches.value[active.value];
      if (p) pick(p);
      return true;
    }
    if (ev.key === 'Escape') { ev.preventDefault(); range.value = null; return true; }
    return false;
  }

  function isOpen(): boolean {
    return range.value !== null && matches.value.length > 0;
  }

  function close(): void { range.value = null; }

  return { matches, range, active, refresh, pick, onKeydown, isOpen, close };
}
