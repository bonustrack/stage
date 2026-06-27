
import { ref } from 'vue';
import { computeMentionQuery, applyMention, type MentionCandidate } from '@stage-labs/client/xmtp/mentions';

export function useComposerMentions(
  getText: () => string,
  getSelStart: () => number,
  getCandidates: () => MentionCandidate[] | undefined,
  setText: (next: string) => void,
  setCaret: (cursor: number) => void,
  afterPick: () => void,
) {
  const matches = ref<MentionCandidate[]>([]);
  const range = ref<{ start: number; end: number } | null>(null);
  const active = ref(0);

  function refresh(): void {
    const res = computeMentionQuery(getText(), getSelStart(), getCandidates());
    matches.value = res.matches;
    range.value = res.matches.length > 0 ? res.range : null;
    if (active.value >= res.matches.length) active.value = 0;
  }

  function pick(c: MentionCandidate): void {
    const r = range.value;
    if (!r) return;
    const { next, cursor } = applyMention(getText(), r, c.address);
    setText(next);
    range.value = null;
    setCaret(cursor);
    afterPick();
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
