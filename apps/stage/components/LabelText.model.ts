export interface LabelPart {
  text: string;
  emoji: boolean;
}

const EMOJI_RANGES: readonly (readonly [number, number])[] = [
  [0x231a, 0x23ff],
  [0x2600, 0x27bf],
  [0x2b00, 0x2bff],
  [0x1f000, 0x1faff],
];

const JOINERS: readonly (readonly [number, number])[] = [
  [0x200d, 0x200d],
  [0xfe0f, 0xfe0f],
  [0xe0020, 0xe007f],
];

function inRanges(cp: number, ranges: readonly (readonly [number, number])[]): boolean {
  return ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
}

export function labelParts(label: string): LabelPart[] {
  const runs: LabelPart[] = [];
  for (const ch of label) {
    const cp = ch.codePointAt(0) ?? 0;
    const emoji = inRanges(cp, EMOJI_RANGES);
    const last = runs[runs.length - 1];
    if (last !== undefined && (last.emoji === emoji || inRanges(cp, JOINERS))) last.text += ch;
    else runs.push({ text: ch, emoji });
  }
  const parts = runs.map((run) => ({ text: run.text.trim(), emoji: run.emoji })).filter((run) => run.text !== '');
  const mixed = parts.some((p) => p.emoji) && parts.some((p) => !p.emoji);
  return mixed ? parts : [{ text: label, emoji: false }];
}
