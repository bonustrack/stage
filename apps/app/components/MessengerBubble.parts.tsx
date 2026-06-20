/** @file Sub-row components for MessengerBubble — @mention chips, mention body, and the question view — extracted to keep the bubble file under the lint cap. */

import { Text } from '@metro-labs/kit/text';
import { useRouter } from 'expo-router';
import { shortAddress } from '../modules/messaging';
import { usePeerProfiles, getPeerName } from '../lib/peerProfiles';
import { MENTION_RE } from './MessengerBubble.helpers';

/** QuestionView lives in MessengerBubble.question.tsx; re-exported so importers keep their './MessengerBubble.parts' path. */
export { QuestionView } from './MessengerBubble.question';

/** One tappable `@username` chip resolved from an address; its own component so usePeerProfiles runs once per mention (cache dedupes ENS lookups), falling back to the short address while resolving. */
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

/** Body text with clickable `@0x<address>` mentions: splits into alternating plain-text and mention runs (each a nested MentionLink); only runs when a mention is present since no-mention messages take a Markdown fast path upstream. */
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
