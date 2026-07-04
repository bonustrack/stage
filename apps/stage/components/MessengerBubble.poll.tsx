
import { Caption } from '@stage-labs/kit/react-native/caption';
import { GesturePressable } from '@stage-labs/kit/react-native/gesture-pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { pollQuestionBlocks, type PollOptionRow, type PollQuestionBlock } from './MessengerBubble.poll.model';
import { Box, Col, Row } from './layout';
import type { Poll } from './MessengerBubble.helpers';
import { usePalette, withAlpha } from '../lib/theme';
import { OpenAnswerBlock } from './MessengerBubble.poll.open';

type PollVotes = Map<number, Map<number, Set<string>>>;
type PollOwn = Map<number, Set<number>>;
type OpenByQ = Map<number, Map<string, { text: string; ts: string }>>;

interface PollColors {
  fillBackground: string;
  selectedBackground: string;
  selectedBorderColor: string;
  borderColor: string;
}

function PollOptionView({ option, colors }: {
  option: PollOptionRow; colors: PollColors;
}): React.ReactElement {
  const side = {
    width: 1,
    color: option.selected ? colors.selectedBorderColor : colors.borderColor,
  };
  return (
    <Box style={{ position: 'relative' }}>
      <Box
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        radius="lg"
        background={option.selected ? colors.selectedBackground : undefined}
        border={{ top: side, right: side, bottom: side, left: side }}
      />
      <Box
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0 }}
        width={`${option.fillPct}%`}
        radius="lg"
        background={colors.fillBackground}
      />
      <Row align="center" justify="between" gap={8} padding={{ x: 12, y: 8 }}>
        <Col flex={1}>
          <Text value={option.label} truncate />
        </Col>
        <Caption value={option.stats} color="secondary" weight="semibold" />
      </Row>
    </Box>
  );
}

function PollQuestionView({ block, qi, colors, onVote }: {
  block: PollQuestionBlock;
  qi: number;
  colors: PollColors;
  onVote: (questionIndex: number, optionIndex: number, action: 'added' | 'removed') => void;
}): React.ReactElement {
  return (
    <Col gap={6}>
      {block.question === undefined ? null : (
        <Text value={block.question} weight="semibold" size="3xl" />
      )}
      {block.header === undefined ? null : (
        <Caption value={block.header} color="secondary" weight="semibold" />
      )}
      {block.options.map((option, oi) => (
        <GesturePressable
          key={`${qi}-${oi}`}
          onPress={() => { onVote(qi, oi, option.selected ? 'removed' : 'added'); }}
        >
          <PollOptionView option={option} colors={colors} />
        </GesturePressable>
      ))}
      <Caption value={block.totalLabel} color="secondary" />
    </Col>
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
  const pal = usePalette();
  const colors: PollColors = {
    fillBackground: withAlpha(pal.link, dark ? 0.16 : 0.12),
    selectedBackground: withAlpha(pal.link, dark ? 0.22 : 0.16),
    selectedBorderColor: pal.link,
    borderColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
  };
  const blocks = pollQuestionBlocks(poll.questions, votes, ownVotes);
  return (
    <Box margin={{ top: 8 }} gap={12} style={{ alignSelf: 'stretch' }}>
      <Col gap={12}>
        {blocks.map((block, qi) => (
          <PollQuestionView key={`q-${qi}`} block={block} qi={qi} colors={colors} onVote={onVote} />
        ))}
      </Col>
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
