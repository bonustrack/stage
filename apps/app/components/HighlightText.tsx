/** @file Renders a string with case-insensitive `query` matches wrapped in a fluo-yellow highlight, used in search and the Home channels list. */

/** Use a bare RN Text so the highlight span inherits surrounding typography and only adds a background; Kit Text would override font size/family. */
import { Text as RNText } from './layout/native';
import { Text } from '@metro-labs/kit/text';

/** Bright fluo-yellow highlight background; the match span only adds this colour and inherits all surrounding typography. */
const HL_BG = '#FFF200';

/** Split `text` into alternating non-match / match segments for `query` (case-insensitive). Returns the original text as a single non-match segment when the query is empty or absent. */
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

/** Returns inline highlight `<Text>` children (not a wrapper) so the caller keeps its own text styling; matched runs get the fluo background, empty query returns the bare string. */
export function highlightSegments(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = splitMatches(text, query);
  return parts.map((p, i) => (
    p.hit
      ? <RNText key={i} style={{ backgroundColor: HL_BG }}>{p.text}</RNText>
      : p.text
  ));
}

/** Renders a string with every case-insensitive occurrence of the query highlighted. */
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
          ? <RNText key={i} style={{ backgroundColor: HL_BG }}>{p.text}</RNText>
          : p.text
      ))}
    </Text>
  );
}
