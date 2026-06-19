/**
 * @file Sub-row components for MessengerBubble — @mention chips, mention body, and
 *  the question view — extracted to keep the bubble file under the lint cap.
 */

import { Text } from '@metro-labs/kit/text';
import { useRouter } from 'expo-router';
import { shortAddress } from '../modules/messaging';
import { usePeerProfiles, getPeerName } from '../lib/peerProfiles';
import { MENTION_RE } from './MessengerBubble.helpers';

// QuestionView lives in MessengerBubble.question.tsx; re-exported so existing
// importers keep their './MessengerBubble.parts' path.
export { QuestionView } from './MessengerBubble.question';

/**
 * One tappable `@username` chip resolved from an address. Lives as its own
 *  component so the `usePeerProfiles` hook is called exactly once per mention
 *  (never inside a loop in the parent) — the shared stamp cache dedupes the
 *  ENS lookup across every chip pointing at the same address. Falls back to the
 *  short address while the name resolves or when there's no ENS name.
 */
function MentionLink({ address, dark }: { address: string; dark: boolean }): React.ReactElement {
  const router = useRouter();
  usePeerProfiles([address]);
  const display = getPeerName(address) ?? shortAddress(address);
  const linkColor = dark ? '#7aa2ff' : '#2f6feb';
  return (
    <Text weight="semibold"
      onPress={() => { router.push({ pathname: '/user/[address]', params: { address } }); }} color={linkColor}
      suppressHighlighting>
      @{display}
    </Text>
  );
}

/**
 * Body text with clickable `@0x<address>` mentions. Splits the raw text into
 *  alternating plain-text runs and mention runs, rendering plain runs with the
 *  bubble's existing markdown body typography (color/size/font) and each mention
 *  as a nested `<MentionLink>`. No-mention messages take a fast path upstream
 *  (the caller renders <Markdown> directly), so this only runs when at least one
 *  address mention is present (markdown isn't applied to those messages).
 */
export function MentionBody({ text, fg, dark, selectable }: { text: string; fg: string; dark: boolean; selectable?: boolean }): React.ReactElement {
  const runs: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  let i = 0;
  while ((m = MENTION_RE.exec(text)) !== null) {
    if (m.index> last) runs.push(text.slice(last, m.index));
    const mentionAddr = m[1] ?? m[0];
    runs.push(<MentionLink key={`m${i}`} address={mentionAddr.toLowerCase()} dark={dark} />);
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) runs.push(text.slice(last));
  return (
    <Text size="3xl" selectable={selectable} color={fg} style={{ lineHeight: 23 }}>
      {runs}
    </Text>
  );
}
