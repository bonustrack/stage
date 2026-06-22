
import { Pressable } from '@stage-labs/kit/react-native/pressable';

import { Text } from '@stage-labs/kit/react-native/text';
import { Row, Box } from './layout';
import type { Poll, PollQuestion } from './MessengerBubble.helpers';
import { usePalette, useBlockRadius, withAlpha } from '../lib/theme';
import { OpenAnswerBlock } from './MessengerBubble.poll.open';

type PollVotes = Map<number, Map<number, Set<string>>>;
type PollOwn = Map<number, Set<number>>;
type OpenByQ = Map<number, Map<string, { text: string; ts: string }>>;

function pollOptionBg(isOn: boolean, pressed: boolean, dark: boolean, linkColor: string): string {
  if (isOn) return withAlpha(linkColor, dark ? 0.22 : 0.16);
  if (pressed) return dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  return dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
}

function PollOption({ opt, isOn, count, pct, multi, dark, sub, onPress }: {
  opt: PollQuestion['options'][number]; isOn: boolean; count: number; pct: number;
  multi: boolean; dark: boolean; sub: string; onPress: () => void;
}): React.ReactElement {
  const pal = usePalette();
  const radius = useBlockRadius();
  const restBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius, overflow: 'hidden',
        backgroundColor: pollOptionBg(isOn, pressed, dark, pal.link),
        borderWidth: 1,
        borderColor: isOn ? pal.link : restBorder,
      })}
    >
      <Box width={`${pct}%`} background={withAlpha(pal.link, dark ? 0.16 : 0.12)}
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }}
      />
      <Row align="center" justify="between">
        <Text size="xl" color={isOn ? '#fff' : pal.text} style={{ flexShrink: 1 }}>
          {isOn ? '✓  ' : (multi ? '☐  ' : '')}{opt.label}
        </Text>
        <Text weight="semibold" size="md" color={isOn ? '#fff' : sub} style={{ marginLeft: 8 }}>
          {count}
        </Text>
      </Row>
      {opt.description ? (
        <Text size="sm" color={sub} style={{ marginTop: 2 }}>

        </Text>
      ) : null}
    </Pressable>
  );
}

function PollQuestionBlock({ q, qi, sub, dark, votes, own, onVote, openAnswers, mine, onOpenAnswer }: {
  q: PollQuestion; qi: number; sub: string; dark: boolean;
  votes?: Map<number, Set<string>>;
  own?: Set<number>;
  onVote: (optionIndex: number, action: 'added' | 'removed') => void;
  openAnswers?: Map<string, { text: string; ts: string }>;
  mine?: string;
  onOpenAnswer?: (text: string) => void;
}): React.ReactElement {
  const multi = q.multiSelect === true;
  const options = Array.isArray(q.options) ? q.options : [];
  const total = options.reduce((n, _o, i) => n + (votes?.get(i)?.size ?? 0), 0);
  const tap = (idx: number): void => { onVote(idx, (own?.has(idx) ?? false) ? 'removed' : 'added'); };
  return (
    <Box gap={6} style={{ alignSelf: 'stretch' }}>
      {q.header ? (
        <Text weight="semibold" size="xs" color={sub} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {q.header}{multi ? ' · multi-select' : ''}{q.open ? ' · open' : ''}
        </Text>
      ) : null}
      {options.map((opt, i) => {
        const count = votes?.get(i)?.size ?? 0;
        const isOn = own?.has(i) ?? false;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <PollOption
            key={`${i}-${opt.label}`} opt={opt} isOn={isOn} count={count} pct={pct}
            multi={multi} dark={dark} sub={sub} onPress={() => { tap(i); }}
          />
        );
      })}
      {options.length > 0 ? (
        <Text size="xs" color={sub} style={{ marginTop: 2 }}>
          {total} vote{total === 1 ? '' : 's'}{q.open ? ' · or type your own' : ''}
        </Text>
      ) : null}
      {q.open && onOpenAnswer ? (
        <OpenAnswerBlock qi={qi} sub={sub} dark={dark} answers={openAnswers} mine={mine} onSubmit={onOpenAnswer}/>
      ) : null}
    </Box>
  );
}

export function PollView({ poll, dark, sub, votes, ownVotes, onVote, openAnswers, onOpenAnswer, myUri }: {
  poll: Poll; dark: boolean; sub: string;
  votes?: PollVotes;
  ownVotes?: PollOwn;
  onVote: (questionIndex: number, optionIndex: number, action: 'added' | 'removed') => void;
  openAnswers?: OpenByQ;
  onOpenAnswer?: (questionIndex: number, text: string) => void;
  myUri?: string;
}): React.ReactElement {
  const multiQuestion = poll.questions.length> 1;
  return (
    <Box margin={{ top: 8 }} gap={12} style={{ alignSelf: 'stretch' }}>
      {poll.questions.map((q, qi) => (
        <Box key={`q-${qi}`} gap={6} style={{ alignSelf: 'stretch' }}>
          {multiQuestion && qi> 0 ? (
            <Text weight="semibold" size="3xl">{q.question}</Text>
          ) : null}
          <PollQuestionBlock
            q={q} qi={qi} sub={sub} dark={dark}
            votes={votes?.get(qi)}
            own={ownVotes?.get(qi)}
            onVote={(o, a) => { onVote(qi, o, a); }}
            openAnswers={openAnswers?.get(qi)}
            mine={myUri}
            onOpenAnswer={onOpenAnswer ? (text) => { onOpenAnswer(qi, text); } : undefined}
/>
        </Box>
      ))}
    </Box>
  );
}
