
import { Text as RNText } from './layout/native';
import { Text } from '@stage-labs/kit/text';

const HL_BG = '#FFF200';

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

export function highlightSegments(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = splitMatches(text, query);
  return parts.map((p, i) => (
    p.hit
      ? <RNText key={i} style={{ backgroundColor: HL_BG }}>{p.text}</RNText>
      : p.text
  ));
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
          ? <RNText key={i} style={{ backgroundColor: HL_BG }}>{p.text}</RNText>
          : p.text
      ))}
    </Text>
  );
}
