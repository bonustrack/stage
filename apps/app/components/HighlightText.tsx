/** HighlightText — renders a body string with every case-insensitive occurrence
 *  of `query` wrapped in a fluo-yellow background (dark text), leaving the rest
 *  in the normal body color. Used in conversation-search mode so matching
 *  messages render in the real feed with the keyword visually picked out, and on
 *  the Home channels list so the matched query stands out in channel names and
 *  last-message previews (via the inline `highlightSegments` helper). */

// the highlight span MUST be a bare RN Text so it inherits the surrounding
// text's font family/size/weight/colour and only adds a background; the Kit Text
// always sets its own fontSize/fontFamily, which would override the row/bubble
// typography. Imported via the sanctioned layout/native escape hatch.
import { Text as RNText } from './layout/native';
import { Text } from '@metro-labs/kit/text';

/** Bright "fluo" yellow highlight. The match span ONLY adds this background -
 *  font family / size / weight / colour are inherited from the surrounding text
 *  (it is a bare RN <Text> nested inside the parent), so the highlight never
 *  changes the typography, just the background colour. */
const HL_BG = '#FFF200';

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

/** Inline highlight segments — returns `<Text>` children (NOT a wrapper) so the
 *  caller can embed them inside its own `<Text>` and keep that text's sizing,
 *  weight, numberOfLines and ellipsize. Non-match segments inherit the parent
 *  `<Text>` style (no color/size override) so the row's title/preview styling is
 *  preserved; only the matched runs get the fluo background + dark ink. When the
 *  query is empty the original text is returned untouched (a bare string). */
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
