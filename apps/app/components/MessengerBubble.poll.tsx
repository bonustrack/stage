/** Interactive poll view for MessengerBubble: per-question option lists with
 *  live vote counts + result bars. One block per question (AskUserQuestion
 *  questions[]); legacy single-question polls render exactly one block. */

import { Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Row, Box } from './layout';
import type { Poll, PollQuestion } from './MessengerBubble.helpers';
import { usePalette } from '../lib/theme';

/** Votes/ownVotes are keyed per QUESTION index then per OPTION index, so a
 *  multi-question poll tallies each question independently. */
type PollVotes = Map<number, Map<number, Set<string>>>;
type PollOwn = Map<number, Set<number>>;

/** One question block: header chip, option list with counts + result bars + a
 *  checkmark on the local user's selected options. Tapping fires
 *  `onVote(optionIndex, action)` for THIS question. Single-select tapping the
 *  option you already own retracts it; tapping a different option casts the new
 *  one (the tally treats the latest 'added' as authoritative). Multi-select
 *  toggles each option independently. */
function PollQuestionBlock({ q, fg, sub, dark, votes, own, onVote }: {
  q: PollQuestion; fg: string; sub: string; dark: boolean;
  votes?: Map<number, Set<string>>;
  own?: Set<number>;
  onVote: (optionIndex: number, action: 'added' | 'removed') => void;
}): React.ReactElement {
  const multi = q.multiSelect === true;
  const total = q.options.reduce((n, _o, i) => n + (votes?.get(i)?.size ?? 0), 0);
  const tap = (idx: number): void => {
    const owned = own?.has(idx) ?? false;
    onVote(idx, owned ? 'removed' : 'added');
  };
  return (
    <Box style={{ alignSelf: 'stretch', gap: 6 }}>
      {q.header ? (
        <Text style={{ color: sub, fontSize: 11, fontFamily: 'Calibre-Semibold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {q.header}{multi ? ' · multi-select' : ''}
        </Text>
      ) : null}
      {q.options.map((opt, i) => {
        const count = votes?.get(i)?.size ?? 0;
        const isOn = own?.has(i) ?? false;
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
            {/** Result bar: width tracks the option's vote share, sits behind the label. */}
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

/** PollView: renders one PollQuestionBlock per question. For a multi-question
 *  poll, each question after the first is preceded by its prompt text (the first
 *  prompt is already shown as the bubble body). Votes are tallied per question;
 *  `onVote` carries the questionIndex so the wire vote encodes (q, o). */
export function PollView({ poll, dark, sub, votes, ownVotes, onVote }: {
  poll: Poll; dark: boolean; sub: string;
  votes?: PollVotes;
  ownVotes?: PollOwn;
  onVote: (questionIndex: number, optionIndex: number, action: 'added' | 'removed') => void;
}): React.ReactElement {
  const fg = usePalette().text; // #9f9fa3 / #57606a
  const multiQuestion = poll.questions.length > 1;
  return (
    <Box style={{ alignSelf: 'stretch', gap: 12, marginTop: 8 }}>
      {poll.questions.map((q, qi) => (
        <Box key={`q-${qi}`} style={{ alignSelf: 'stretch', gap: 6 }}>
          {/** The first question's prompt is the bubble body; later ones need their own. */}
          {multiQuestion && qi > 0 ? (
            <Text style={{ color: fg, fontSize: 17, fontFamily: 'Calibre-Semibold' }}>{q.question}</Text>
          ) : null}
          <PollQuestionBlock
            q={q} fg={fg} sub={sub} dark={dark}
            votes={votes?.get(qi)}
            own={ownVotes?.get(qi)}
            onVote={(o, a) => onVote(qi, o, a)}
          />
        </Box>
      ))}
    </Box>
  );
}
