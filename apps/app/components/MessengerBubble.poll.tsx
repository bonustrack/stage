/** Interactive poll view for MessengerBubble — vote counts + result bars.
 *  Extracted to keep the parts file under the phase-2 lint cap. */

import { Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Row, Box } from './layout';
import type { Poll } from './MessengerBubble.helpers';
import { usePalette } from '../lib/theme';

/** PollView — clone of QuestionView, minus the Other / free-text affordance,
 *  plus live per-option vote counts, a filled result bar, and a checkmark on the
 *  options the local user has selected (`ownVotes`). Tapping an option fires
 *  `onVote(index, action)`; single-select tapping the option you already own
 *  retracts it (action:'removed'), tapping a different option casts the new one
 *  (the tally treats the latest 'added' as authoritative). Multi-select toggles
 *  each option independently. */
export function PollView({ poll, dark, sub, votes, ownVotes, onVote }: {
  poll: Poll; dark: boolean; sub: string;
  votes?: Map<number, Set<string>>;
  ownVotes?: Set<number>;
  onVote: (optionIndex: number, action: 'added' | 'removed') => void;
}): React.ReactElement {
  const fg = usePalette().text; // #9f9fa3 / #57606a
  const multi = poll.multiSelect === true;
  const total = poll.options.reduce((n, _o, i) => n + (votes?.get(i)?.size ?? 0), 0);
  const tap = (idx: number): void => {
    const owned = ownVotes?.has(idx) ?? false;
    onVote(idx, owned ? 'removed' : 'added');
  };
  return (
    <Box style={{ alignSelf: 'stretch', gap: 6, marginTop: 8 }}>
      {poll.header ? (
        <Text style={{ color: sub, fontSize: 11, fontFamily: 'Calibre-Semibold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {poll.header}{multi ? ' · multi-select' : ''}
        </Text>
      ) : null}
      {poll.options.map((opt, i) => {
        const count = votes?.get(i)?.size ?? 0;
        const isOn = ownVotes?.has(i) ?? false;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <Pressable
            key={`${i}-${opt.label}`}
            onPress={() => tap(i)}
            style={({ pressed }) => ({
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: isOn
                ? (dark ? 'rgba(192,160,110,0.22)' : 'rgba(192,160,110,0.18)')
                : pressed
                  ? (dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)')
                  : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'),
              borderWidth: 1,
              borderColor: isOn ? '#c0a06e' : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'),
            })}
          >
            {/** Result bar — width tracks the option's vote share, sits behind the label. */}
            <Box
              pointerEvents="none"
              style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${pct}%`,
                backgroundColor: dark ? 'rgba(192,160,110,0.16)' : 'rgba(192,160,110,0.14)',
              }}
            />
            <Row align="center" justify="between">
              <Text style={{ color: fg, fontSize: 15, fontFamily: 'Calibre-Medium', flexShrink: 1 }}>
                {isOn ? '✓  ' : (multi ? '☐  ' : '')}{opt.label}
              </Text>
              <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Semibold', marginLeft: 8 }}>
                {count}
              </Text>
            </Row>
            {opt.description ? (
              <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', marginTop: 2 }}>
                {opt.description}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      <Text style={{ color: sub, fontSize: 11, fontFamily: 'Calibre-Medium', marginTop: 2 }}>
        {total} vote{total === 1 ? '' : 's'}
      </Text>
    </Box>
  );
}
