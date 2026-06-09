/** Interactive poll view for MessengerBubble: per-question option lists with
 *  live vote counts + result bars, plus a free-text input for OPEN questions
 *  (and the submitted answers under it). One block per question (AskUserQuestion
 *  questions[]); legacy single-question polls render exactly one block.
 *
 *  Styling: all colors track the active theme via usePalette / withAlpha (Kit
 *  tokens) - the gold accent is now the palette `link` token. The send affordance
 *  uses the Kit Button. Kit has no progress/meter primitive (the kit only mirrors
 *  ChatKit components), so the result bar is an absolutely-positioned fill tinted
 *  from the `link` token rather than a hardcoded color. */

import { Pressable } from '@metro-labs/kit/pressable';

import { Text } from '@metro-labs/kit/text';
import { Row, Box } from './layout';
import type { Poll, PollQuestion } from './MessengerBubble.helpers';
import { usePalette, useBlockRadius, withAlpha } from '../lib/theme';
import { OpenAnswerBlock } from './MessengerBubble.poll.open';

/** Votes/ownVotes are keyed per QUESTION index then per OPTION index, so a
 *  multi-question poll tallies each question independently. */
type PollVotes = Map<number, Map<number, Set<string>>>;
type PollOwn = Map<number, Set<number>>;
type OpenByQ = Map<number, Map<string, { text: string; ts: string }>>;

/** One question block: header chip, option list with counts + result bars + a
 *  checkmark on the local user's selected options. Open questions append a
 *  free-text input below the options (or stand alone with no options). */
function PollQuestionBlock({ q, qi, sub, dark, votes, own, onVote, openAnswers, mine, onOpenAnswer }: {
  q: PollQuestion; qi: number; sub: string; dark: boolean;
  votes?: Map<number, Set<string>>;
  own?: Set<number>;
  onVote: (optionIndex: number, action: 'added' | 'removed') => void;
  openAnswers?: Map<string, { text: string; ts: string }>;
  mine?: string;
  onOpenAnswer?: (text: string) => void;
}): React.ReactElement {
  const pal = usePalette();
  const radius = useBlockRadius();
  const multi = q.multiSelect === true;
  const options = Array.isArray(q.options) ? q.options : [];
  const total = options.reduce((n, _o, i) => n + (votes?.get(i)?.size ?? 0), 0);
  const tap = (idx: number): void => onVote(idx, (own?.has(idx) ?? false) ? 'removed' : 'added');
  const restBg = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const pressBg = dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  const restBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  return (
    <Box style={{ alignSelf: 'stretch', gap: 6 }}>
      {q.header ? (
        <Text weight="semibold" size="sm" style={{ color: sub, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {q.header}{multi ? ' · multi-select' : ''}{q.open ? ' · open' : ''}
        </Text>
      ) : null}
      {options.map((opt, i) => {
        const count = votes?.get(i)?.size ?? 0;
        const isOn = own?.has(i) ?? false;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <Pressable
            key={`${i}-${opt.label}`}
            onPress={() => tap(i)}
            style={({ pressed }) => ({
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius, overflow: 'hidden',
              backgroundColor: isOn
                ? withAlpha(pal.link, dark ? 0.22 : 0.16)
                : pressed ? pressBg : restBg,
              borderWidth: 1,
              borderColor: isOn ? pal.link : restBorder,
            })}
          >
            <Box
              pointerEvents="none"
              style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${pct}%`,
                backgroundColor: withAlpha(pal.link, dark ? 0.16 : 0.12),
              }}
            />
            <Row align="center" justify="between">
              <Text size="lg" style={{ color: isOn ? '#fff' : pal.text, flexShrink: 1 }}>
                {isOn ? '✓  ' : (multi ? '☐  ' : '')}{opt.label}
              </Text>
              <Text weight="semibold" size="md" style={{ color: isOn ? '#fff' : sub, marginLeft: 8 }}>
                {count}
              </Text>
            </Row>
            {opt.description ? (
              <Text size="md" style={{ color: sub, marginTop: 2 }}>
                {opt.description}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      {options.length > 0 ? (
        <Text size="sm" style={{ color: sub, marginTop: 2 }}>
          {total} vote{total === 1 ? '' : 's'}{q.open ? ' · or type your own' : ''}
        </Text>
      ) : null}
      {q.open && onOpenAnswer ? (
        <OpenAnswerBlock qi={qi} sub={sub} dark={dark} answers={openAnswers} mine={mine} onSubmit={onOpenAnswer} />
      ) : null}
    </Box>
  );
}

/** PollView: renders one PollQuestionBlock per question. Votes tally per question;
 *  open answers are carried per question; `onVote`/`onOpenAnswer` carry the
 *  questionIndex so the wire encodes (q, …). */
export function PollView({ poll, dark, sub, votes, ownVotes, onVote, openAnswers, onOpenAnswer, myUri }: {
  poll: Poll; dark: boolean; sub: string;
  votes?: PollVotes;
  ownVotes?: PollOwn;
  onVote: (questionIndex: number, optionIndex: number, action: 'added' | 'removed') => void;
  openAnswers?: OpenByQ;
  onOpenAnswer?: (questionIndex: number, text: string) => void;
  myUri?: string;
}): React.ReactElement {
  const pal = usePalette();
  const fg = pal.link;
  const multiQuestion = poll.questions.length > 1;
  return (
    <Box style={{ alignSelf: 'stretch', gap: 12, marginTop: 8 }}>
      {poll.questions.map((q, qi) => (
        <Box key={`q-${qi}`} style={{ alignSelf: 'stretch', gap: 6 }}>
          {multiQuestion && qi > 0 ? (
            <Text weight="semibold" size="xl" style={{ color: fg }}>{q.question}</Text>
          ) : null}
          <PollQuestionBlock
            q={q} qi={qi} sub={sub} dark={dark}
            votes={votes?.get(qi)}
            own={ownVotes?.get(qi)}
            onVote={(o, a) => onVote(qi, o, a)}
            openAnswers={openAnswers?.get(qi)}
            mine={myUri}
            onOpenAnswer={onOpenAnswer ? (text) => onOpenAnswer(qi, text) : undefined}
          />
        </Box>
      ))}
    </Box>
  );
}
