import { useMemo } from 'react';
import { openInBubbleLink } from '../../lib/safeOpenLink';

import { Text } from '@stage-labs/kit/react-native/text';
import Markdown from 'react-native-markdown-display';
import { messageCardLinks } from './markdown.model';
import { isAttachmentSummary } from './fileCard.model';
import { Box, Row } from '../layout';
import type { HistoryEntry } from '@stage-labs/client/types';
import { deletedTextOf } from '@stage-labs/client/xmtp/deleteMessage';
import { deletedByOf, isDeletedPlaceholder } from '@stage-labs/client/xmtp/deletions';
import {
  attachmentsOf, mdParser, markdownStyles,
  questionOf, pollOf, sigRequestOf, sigReferenceOf, txRequestOf, txReceiptOf,
} from './helpers';
import { QuestionView } from './question';
import { PollView } from './poll';
import { TxRequestCard, TxReceiptCard } from './cards';
import { SigRequestCard, SigReferenceCard } from './cards.sig';
import { FramePreview } from '../frame/FramePreview';
import { CallCard } from './CallCard';
import type { CallRecord } from './callCard.model';
import type { MessengerBubbleProps } from './props';
import { frameOf, isFrameActionEntry } from '../frame/frame.model';
import { bubbleTimestamp } from '../../lib/format';
import {
  BubbleAttachments, BubbleBody, BubbleEmbeds, FrameActionLine, ReplyPreview, markdownRules, type MarkdownProps,
} from './content.parts';

function descriptorsOf(entry: HistoryEntry): {
  atts: ReturnType<typeof attachmentsOf>; question: ReturnType<typeof questionOf>;
  poll: ReturnType<typeof pollOf>; sigReq: ReturnType<typeof sigRequestOf>;
  sigRef: ReturnType<typeof sigReferenceOf>; txReq: ReturnType<typeof txRequestOf>;
  txReceipt: ReturnType<typeof txReceiptOf>; frame: ReturnType<typeof frameOf>; frameAction: boolean;
} {
  return {
    atts: attachmentsOf(entry), question: questionOf(entry), poll: pollOf(entry),
    sigReq: sigRequestOf(entry), sigRef: sigReferenceOf(entry),
    txReq: txRequestOf(entry), txReceipt: txReceiptOf(entry), frame: frameOf(entry),
    frameAction: isFrameActionEntry(entry),
  };
}

type BubbleContentProps = Pick<MessengerBubbleProps,
  'entry' | 'dark' | 'pending' | 'replyPreview' | 'onReplyPreviewPress' | 'onAnswer' | 'votes' | 'ownVotes' | 'onVote'
  | 'openAnswers' | 'onOpenAnswer' | 'myUri' | 'call' | 'onPay' | 'paying' | 'onSign' | 'signing' | 'consentAllowed'
  | 'highlight'
> & { fg: string; sub: string };

function BubbleMain({ d, entry, fg, call, highlight, markdownProps }: {
  d: ReturnType<typeof descriptorsOf>; entry: HistoryEntry; fg: string; call?: CallRecord;
  highlight?: string; markdownProps: MarkdownProps;
}): React.ReactElement | null {
  if (isDeletedPlaceholder(entry)) {
    return <Text size="lg" color={fg} style={{ lineHeight: 23 }}>{deletedTextOf(deletedByOf(entry))}</Text>;
  }
  if (d.poll) {
    return d.poll.question ? (
      <Box style={{ alignSelf: 'stretch' }}><Markdown {...markdownProps}>{d.poll.question}</Markdown></Box>
    ) : null;
  }
  if (d.txReq || d.txReceipt || d.frame || call) return null;
  if (!entry.text || isAttachmentSummary(entry.text, d.atts.length)) return null;
  return <BubbleBody text={entry.text} fg={fg} highlight={highlight} markdownProps={markdownProps} />;
}

function BubbleCards({ d, p }: { d: ReturnType<typeof descriptorsOf>; p: BubbleContentProps }): React.ReactElement {
  return (
    <>
      {d.question && p.onAnswer ? (
        <QuestionView question={d.question} dark={p.dark} onAnswer={p.onAnswer} />
      ) : null}
      {d.poll && p.onVote ? (
        <PollView
          poll={d.poll} dark={p.dark} votes={p.votes} ownVotes={p.ownVotes} onVote={p.onVote}
          openAnswers={p.openAnswers} onOpenAnswer={p.onOpenAnswer} myUri={p.myUri}
        />
      ) : null}
      {d.sigReq ? (
        <SigRequestCard req={d.sigReq} dark={p.dark} signing={p.signing} onSign={p.onSign} consentAllowed={p.consentAllowed} />
      ) : null}
      {d.sigRef ? <SigReferenceCard ref={d.sigRef} ts={p.entry.ts} dark={p.dark} /> : null}
      {d.txReq ? (
        <TxRequestCard req={d.txReq} dark={p.dark} paying={p.paying} onPay={p.onPay} consentAllowed={p.consentAllowed} />
      ) : null}
      {d.txReceipt ? <TxReceiptCard receipt={d.txReceipt} ts={p.entry.ts} dark={p.dark} /> : null}
      {d.frame ? (
        <FramePreview frame={d.frame} line={p.entry.line} messageId={p.entry.id} consentAllowed={p.consentAllowed} />
      ) : null}
    </>
  );
}

export function BubbleContent(props: BubbleContentProps): React.ReactElement {
  const { entry, dark, pending, fg, sub, replyPreview, onReplyPreviewPress, highlight } = props;
  const d = useMemo(() => descriptorsOf(entry), [entry]);
  const cardLinks = useMemo(() => messageCardLinks(entry.text, mdParser), [entry.text]);
  const textSize = d.poll ? 'md' : 'lg';
  const mdStyle = useMemo(() => markdownStyles(fg, dark, textSize), [fg, dark, textSize]);
  const markdownProps = useMemo((): MarkdownProps => ({
    markdownit: mdParser,
    onLinkPress: (url: string): boolean => openInBubbleLink(url),
    rules: markdownRules,
    style: mdStyle,
  }), [mdStyle]);
  return (
    <>
      <Row align="center" justify="start" style={{ alignSelf: 'stretch' }}>
        <Text role="secondary" size="3xs">{pending ? 'Sending' : bubbleTimestamp(entry.ts)}</Text>
      </Row>
      <ReplyPreview preview={replyPreview} fg={fg} sub={sub} onPress={onReplyPreviewPress} />
      <BubbleAttachments atts={d.atts} entryId={entry.id} fg={fg} />
      {d.frameAction ? <FrameActionLine text={entry.text ?? ''} fg={fg} /> : (
        <BubbleMain d={d} entry={entry} fg={fg} call={props.call} highlight={highlight} markdownProps={markdownProps} />
      )}
      <BubbleEmbeds cardLinks={cardLinks} dark={dark} />
      {props.call ? <CallCard record={props.call} line={entry.line} /> : null}
      <BubbleCards d={d} p={props} />
    </>
  );
}
