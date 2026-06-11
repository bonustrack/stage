/** HighlightText — renders a body string with every case-insensitive occurrence
 *  of `query` wrapped in a fluo-yellow background (dark text), leaving the rest
 *  in the normal body color. Used only in conversation-search mode so matching
 *  messages render in the real feed with the keyword visually picked out. */

import { Text } from '@metro-labs/kit/text';

/** Bright "fluo" yellow highlight + near-black ink so the match pops on any
 *  bubble background regardless of theme. */
const HL_BG = '#FFF200';
const HL_FG = '#1A1A1A';

/** Split `text` into alternating non-match / match segments for `query`
 *  (case-insensitive). Returns the original text as a single non-match segment
 *  when the query is empty or absent. */
function splitMatches(text: string, query: string): { text: string; hit: boolean }[] {
  const q = query.trim();
  if (!q) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const out: { text: string; hit: boolean }[] = [];
  let from = 0;
  for (;;) {
    const i = lower.indexOf(needle, from);
    if (i < 0) { out.push({ text: text.slice(from), hit: false }); break; }
    if (i > from) out.push({ text: text.slice(from, i), hit: false });
    out.push({ text: text.slice(i, i + needle.length), hit: true });
    from = i + needle.length;
  }
  return out;
}

export function HighlightText({ text, query, fg }: {
  text: string;
  query: string;
  fg: string;
}): React.ReactElement {
  const parts = splitMatches(text, query);
  return (
    <Text size="3xl" color={fg} style={{ lineHeight: 23 }}>
      {parts.map((p, i) => (
        p.hit
          ? <Text key={i} size="3xl" color={HL_FG} style={{ backgroundColor: HL_BG, lineHeight: 23 }}>{p.text}</Text>
          : <Text key={i} size="3xl" color={fg} style={{ lineHeight: 23 }}>{p.text}</Text>
      ))}
    </Text>
  );
}
