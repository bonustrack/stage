
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers } from '@stage-labs/kit/kit';
import { basicRoot, pollCard, POLL_OPTION_PRESS, type PollQuestion as ViewPollQuestion } from '@stage-labs/views';

import { Box } from './layout';
import type { Poll, PollQuestion } from './MessengerBubble.helpers';
import { usePalette, withAlpha } from '../lib/theme';
import { OpenAnswerBlock } from './MessengerBubble.poll.open';

type PollVotes = Map<number, Map<number, Set<string>>>;
type PollOwn = Map<number, Set<number>>;
type OpenByQ = Map<number, Map<string, { text: string; ts: string }>>;

function buildQuestion(
  q: PollQuestion,
  votes: Map<number, Set<string>> | undefined,
  own: Set<number> | undefined,
  showQuestion: boolean,
): ViewPollQuestion {
  const options = Array.isArray(q.options) ? q.options : [];
  const total = options.reduce((n, _o, i) => n + (votes?.get(i)?.size ?? 0), 0);
  const multi = q.multiSelect === true;
  const suffix = q.open === true ? ' · open' : '';
  return {
    question: showQuestion ? q.question : '',
    header: q.header !== undefined ? `${q.header}${suffix}` : undefined,
    multiSelect: multi,
    total,
    options: options.map((opt, i) => {
      const votesN = votes?.get(i)?.size ?? 0;
      return {
        label: opt.label,
        votes: votesN,
        pct: total > 0 ? Math.round((votesN / total) * 100) : 0,
        selected: own?.has(i) ?? false,
      };
    }),
  };
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
  const pal = usePalette();
  const multiQuestion = poll.questions.length > 1;
  const questions = poll.questions.map((q, qi) =>
    buildQuestion(q, votes?.get(qi), ownVotes?.get(qi), multiQuestion && qi > 0),
  );
  const node = basicRoot(
    pollCard({
      questions,
      dispatchPress: true,
      fillBackground: withAlpha(pal.link, dark ? 0.16 : 0.12),
      selectedBackground: withAlpha(pal.link, dark ? 0.22 : 0.16),
      selectedBorderColor: pal.link,
      borderColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
    }),
  );
  const actions: PayloadHandlers = {
    [POLL_OPTION_PRESS]: (payload) => {
      const qi = Number(payload.questionIndex);
      const oi = Number(payload.optionIndex);
      const selected = payload.selected === true || payload.selected === 'true';
      if (Number.isNaN(qi) || Number.isNaN(oi)) return;
      onVote(qi, oi, selected ? 'removed' : 'added');
    },
  };
  return (
    <Box margin={{ top: 8 }} gap={12} style={{ alignSelf: 'stretch' }}>
      <ViewHost node={node} actions={actions} />
      {poll.questions.map((q, qi) => (
        q.open === true && onOpenAnswer ? (
          <OpenAnswerBlock
            key={`open-${qi}`} qi={qi} sub={sub} dark={dark}
            answers={openAnswers?.get(qi)} mine={myUri}
            onSubmit={(text) => { onOpenAnswer(qi, text); }}
          />
        ) : null
      ))}
    </Box>
  );
}
