/** Interactive poll view for MessengerBubble: per-question option lists with
 *  live vote counts + result bars, plus a free-text input for OPEN questions
 *  (and the submitted answers under it). One block per question (AskUserQuestion
 *  questions[]); legacy single-question polls render exactly one block. */

import { useState } from 'react';
import { Pressable, TextInput } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Row, Box } from './layout';
import type { Poll, PollQuestion } from './MessengerBubble.helpers';
import { usePalette } from '../lib/theme';

/** Votes/ownVotes are keyed per QUESTION index then per OPTION index, so a
 *  multi-question poll tallies each question independently. */
type PollVotes = Map<number, Map<number, Set<string>>>;
type PollOwn = Map<number, Set<number>>;
type OpenByQ = Map<number, Map<string, { text: string; ts: string }>>;

/** Free-text input + submitted-answers list for an OPEN question. Submitting an
 *  empty box retracts the local user's prior answer. */
function OpenAnswerBlock({ qi, fg, sub, dark, answers, mine, onSubmit }: {
  qi: number; fg: string; sub: string; dark: boolean;
  answers?: Map<string, { text: string; ts: string }>;
  mine?: string; onSubmit: (text: string) => void;
}): React.ReactElement {
  const [draft, setDraft] = useState('');
  const list = answers ? [...answers.entries()].sort((a, b) => a[1].ts.localeCompare(b[1].ts)) : [];
  const submit = (): void => { onSubmit(draft); setDraft(''); };
  return (
    <Box style={{ alignSelf: 'stretch', gap: 6, marginTop: 2 }}>
      <Row align="center" justify="between" style={{ gap: 8 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          placeholder="Type your answer…"
          placeholderTextColor={sub}
          returnKeyType="send"
          style={{
            flex: 1, color: fg, fontSize: 15, fontFamily: 'Calibre-Medium',
            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1,
            borderColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
            backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
          }}
        />
        <Pressable
          onPress={submit}
          disabled={draft.trim().length === 0}
          style={({ pressed }) => ({
            paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
            opacity: draft.trim().length === 0 ? 0.4 : pressed ? 0.7 : 1,
            backgroundColor: '#c0a06e',
          })}
        >
          <Text style={{ color: '#1a1a1a', fontSize: 14, fontFamily: 'Calibre-Semibold' }}>Send</Text>
        </Pressable>
      </Row>
      {list.map(([voter, a]) => (
        <Box
          key={`${qi}-${voter}`}
          style={{
            alignSelf: 'stretch', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
            backgroundColor: voter === mine
              ? (dark ? 'rgba(192,160,110,0.18)' : 'rgba(192,160,110,0.14)')
              : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'),
          }}
        >
          <Text style={{ color: fg, fontSize: 14, fontFamily: 'Calibre-Medium' }}>
            {voter === mine ? 'You: ' : ''}{a.text}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

/** One question block: header chip, option list with counts + result bars + a
 *  checkmark on the local user's selected options. Open questions append a
 *  free-text input below the options (or stand alone with no options). */
function PollQuestionBlock({ q, qi, fg, sub, dark, votes, own, onVote, openAnswers, mine, onOpenAnswer }: {
  q: PollQuestion; qi: number; fg: string; sub: string; dark: boolean;
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
  const tap = (idx: number): void => onVote(idx, (own?.has(idx) ?? false) ? 'removed' : 'added');
  return (
    <Box style={{ alignSelf: 'stretch', gap: 6 }}>
      {q.header ? (
        <Text style={{ color: sub, fontSize: 11, fontFamily: 'Calibre-Semibold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, overflow: 'hidden',
              backgroundColor: isOn
                ? (dark ? 'rgba(192,160,110,0.22)' : 'rgba(192,160,110,0.18)')
                : pressed
                  ? (dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)')
                  : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'),
              borderWidth: 1,
              borderColor: isOn ? '#c0a06e' : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'),
            })}
          >
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
      {options.length > 0 ? (
        <Text style={{ color: sub, fontSize: 11, fontFamily: 'Calibre-Medium', marginTop: 2 }}>
          {total} vote{total === 1 ? '' : 's'}{q.open ? ' · or type your own' : ''}
        </Text>
      ) : null}
      {q.open && onOpenAnswer ? (
        <OpenAnswerBlock qi={qi} fg={fg} sub={sub} dark={dark} answers={openAnswers} mine={mine} onSubmit={onOpenAnswer} />
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
  const fg = usePalette().text;
  const multiQuestion = poll.questions.length > 1;
  return (
    <Box style={{ alignSelf: 'stretch', gap: 12, marginTop: 8 }}>
      {poll.questions.map((q, qi) => (
        <Box key={`q-${qi}`} style={{ alignSelf: 'stretch', gap: 6 }}>
          {multiQuestion && qi > 0 ? (
            <Text style={{ color: fg, fontSize: 17, fontFamily: 'Calibre-Semibold' }}>{q.question}</Text>
          ) : null}
          <PollQuestionBlock
            q={q} qi={qi} fg={fg} sub={sub} dark={dark}
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
