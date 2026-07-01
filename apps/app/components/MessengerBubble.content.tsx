
import { useMemo } from 'react';
import { openInBubbleLink } from '../lib/safeOpenLink';

import { Text } from '@stage-labs/kit/react-native/text';
import Markdown from 'react-native-markdown-display';
import { cardLinksOf } from '../lib/cardLinks';
import { Box, Row } from './layout';
import type { HistoryEntry } from '@stage-labs/client/types';
import {
  attachmentsOf, mdParser, markdownStyles,
  questionOf, pollOf, sigRequestOf, sigReferenceOf, txRequestOf, txReceiptOf,
} from './MessengerBubble.helpers';
import { QuestionView } from './MessengerBubble.parts';
import { PollView } from './MessengerBubble.poll';
import { SigRequestCard, SigReferenceCard, TxRequestCard, TxReceiptCard } from './MessengerBubble.cards';
import { bubbleTimestamp } from '@stage-labs/views';
import {
  BubbleAttachments, BubbleBody, BubbleEmbeds, ReplyPreview, TranscriptLine, type MarkdownProps,
} from './MessengerBubble.content.parts';

function descriptorsOf(entry: HistoryEntry): {
  atts: ReturnType<typeof attachmentsOf>; question: ReturnType<typeof questionOf>;
  poll: ReturnType<typeof pollOf>; sigReq: ReturnType<typeof sigRequestOf>;
  sigRef: ReturnType<typeof sigReferenceOf>; txReq: ReturnType<typeof txRequestOf>;
  txReceipt: ReturnType<typeof txReceiptOf>;
} {
  return {
    atts: attachmentsOf(entry), question: questionOf(entry), poll: pollOf(entry),
    sigReq: sigRequestOf(entry), sigRef: sigReferenceOf(entry),
    txReq: txRequestOf(entry), txReceipt: txReceiptOf(entry),
  };
}

interface BubbleContentProps {
  entry: HistoryEntry; dark: boolean; pending?: boolean; fg: string; sub: string;
  replyPreview?: string; onReplyPreviewPress?: () => void; transcript?: string;
  onAnswer?: (label: string) => void;
  votes?: Map<number, Map<number, Set<string>>>; ownVotes?: Map<number, Set<number>>;
  onVote?: (questionIndex: number, optionIndex: number, action: 'added' | 'removed') => void;
  openAnswers?: Map<number, Map<string, { text: string; ts: string }>>;
  onOpenAnswer?: (questionIndex: number, text: string) => void;
  myUri?: string;
  onPay?: () => void; paying?: boolean; onSign?: () => void; signing?: boolean;
  consentAllowed?: boolean;
  selectable?: boolean;
  highlight?: string;
}

function BubbleMain({ d, entry, fg, dark, selectable, highlight, markdownProps }: {
  d: ReturnType<typeof descriptorsOf>; entry: HistoryEntry; fg: string; dark: boolean;
  selectable?: boolean; highlight?: string; markdownProps: MarkdownProps;
}): React.ReactElement | null {
  if (d.poll) {
    return d.poll.question ? (
      <Box style={{ alignSelf: 'stretch' }}><Markdown {...markdownProps}>{d.poll.question}</Markdown></Box>
    ) : null;
  }
  if (d.txReq || d.txReceipt) return null;
  if (!entry.text) return null;
  return <BubbleBody text={entry.text} fg={fg} dark={dark} selectable={selectable} highlight={highlight} markdownProps={markdownProps} />;
}

function BubbleCards({ d, p }: { d: ReturnType<typeof descriptorsOf>; p: BubbleContentProps }): React.ReactElement {
  return (
    <>
      {d.question && p.onAnswer ? (
        <QuestionView question={d.question} dark={p.dark} sub={p.sub} onAnswer={p.onAnswer} />
      ) : null}
      {d.poll && p.onVote ? (
        <PollView
          poll={d.poll} dark={p.dark} sub={p.sub} votes={p.votes} ownVotes={p.ownVotes} onVote={p.onVote}
          openAnswers={p.openAnswers} onOpenAnswer={p.onOpenAnswer} myUri={p.myUri}
        />
      ) : null}
      {d.sigReq ? (
        <SigRequestCard req={d.sigReq} dark={p.dark} signing={p.signing} onSign={p.onSign} consentAllowed={p.consentAllowed} />
      ) : null}
      {d.sigRef ? <SigReferenceCard ref={d.sigRef} dark={p.dark} /> : null}
      {d.txReq ? (
        <TxRequestCard req={d.txReq} dark={p.dark} sub={p.sub} paying={p.paying} onPay={p.onPay} consentAllowed={p.consentAllowed} />
      ) : null}
      {d.txReceipt ? <TxReceiptCard receipt={d.txReceipt} dark={p.dark} /> : null}
    </>
  );
}

export function BubbleContent(props: BubbleContentProps): React.ReactElement {
  const { entry, dark, pending, fg, sub, replyPreview, onReplyPreviewPress, transcript, selectable, highlight } = props;
  const d = useMemo(() => descriptorsOf(entry), [entry]);
  const cardLinks = useMemo(() => cardLinksOf(entry.text), [entry.text]);
  const mdStyle = useMemo(() => markdownStyles(fg, dark, false), [fg, dark]);
  const markdownProps: MarkdownProps = {
    markdownit: mdParser,
    onLinkPress: (url: string): boolean => openInBubbleLink(url),
    style: mdStyle,
  };
  return (
    <>
      <Row align="center" justify="start" style={{ alignSelf: 'stretch' }}>
        <Text size="3xs" role="secondary">{pending ? 'Sending' : bubbleTimestamp(entry.ts)}</Text>
      </Row>
      <ReplyPreview preview={replyPreview} fg={fg} sub={sub} onPress={onReplyPreviewPress} />
      <BubbleAttachments atts={d.atts} entryId={entry.id} fg={fg} dark={dark} />
      <BubbleMain d={d} entry={entry} fg={fg} dark={dark} selectable={selectable} highlight={highlight} markdownProps={markdownProps} />
      <BubbleEmbeds cardLinks={cardLinks} dark={dark} />
      <BubbleCards d={d} p={props} />
      <TranscriptLine transcript={transcript} atts={d.atts} entryTs={entry.ts} />
    </>
  );
}
