import { useMemo } from 'react';
import { openInBubbleLink } from '../../lib/capabilities';
import { Text } from '@stage-labs/kit/react-native/text';
import Markdown from 'react-native-markdown-display';
import { messageCardLinks } from './markdown.model';
import type { HistoryEntry } from '@stage-labs/client/types';
import { deletedTextOf } from '@stage-labs/client/xmtp/deleteMessage';
import {
  attachmentsOf,
  deletedByOf,
  isAttachmentSummary,
  messageKindOf,
  signatureReferenceOf,
  signatureRequestOf,
  txReferenceOf,
  walletSendCallsOf,
  type MessageKind,
} from '@stage-labs/client/xmtp/entryPayload';
import { mdParser, markdownStyles } from './markdown';
import { pollOf } from './poll.model';
import { PollView } from './poll';
import { TxRequestCard, TxReceiptCard } from './cards';
import { SigRequestCard, SigReferenceCard } from './cards.sig';
import { FramePreview } from '../frame/FramePreview';
import { CallCard } from './CallCard';
import type { CallRecord } from './callCard.model';
import type { BubbleHandlers, BubbleModel } from './model';
import { frameOf } from '../../lib/frames/frame.model';
import { bubbleTimestamp } from '../../lib/format';
import {
  BubbleAttachments,
  BubbleBody,
  BubbleEmbeds,
  FrameActionLine,
  ReplyPreview,
  markdownRules,
  type MarkdownProps,
} from './content.parts';
import { Column, Row } from '../layout';
import { MESSAGE_BODY } from './MessageText';

const NO_BODY_KINDS: ReadonlySet<MessageKind> = new Set(['txRequest', 'txReceipt']);

function descriptorsOf(entry: HistoryEntry) {
  return {
    kind: messageKindOf(entry),
    atts: attachmentsOf(entry),
    poll: pollOf(entry),
    sigReq: signatureRequestOf(entry),
    sigRef: signatureReferenceOf(entry),
    txReq: walletSendCallsOf(entry),
    txReceipt: txReferenceOf(entry),
    frame: frameOf(entry),
  };
}

type Descriptors = ReturnType<typeof descriptorsOf>;

interface BubbleContentProps {
  model: BubbleModel;
  h: BubbleHandlers;
  fg: string;
  sub: string;
}

function BubbleMain({
  d,
  entry,
  fg,
  call,
  highlight,
  markdownProps,
}: {
  d: Descriptors;
  entry: HistoryEntry;
  fg: string;
  call?: CallRecord;
  highlight?: string;
  markdownProps: MarkdownProps;
}): React.ReactElement | null {
  if (d.kind === 'deleted') {
    return (
      <Text size={MESSAGE_BODY.size} color={fg} style={{ lineHeight: MESSAGE_BODY.lineHeight }}>
        {deletedTextOf(deletedByOf(entry))}
      </Text>
    );
  }
  if (d.poll) {
    return d.poll.question ? (
      <Column style={{ alignSelf: 'stretch' }}>
        <Markdown {...markdownProps}>{d.poll.question}</Markdown>
      </Column>
    ) : null;
  }
  if (NO_BODY_KINDS.has(d.kind) || d.frame || call) return null;
  if (!entry.text || isAttachmentSummary(entry)) return null;
  return <BubbleBody text={entry.text} fg={fg} highlight={highlight} markdownProps={markdownProps} />;
}

function BubbleCards({ d, model: p, h }: { d: Descriptors; model: BubbleModel; h: BubbleHandlers }): React.ReactElement {
  return (
    <>
      {d.poll && h.onVote ? (
        <PollView
          poll={d.poll}
          dark={p.dark}
          votes={p.votes}
          ownVotes={p.ownVotes}
          onVote={h.onVote}
          openAnswers={p.openAnswers}
          onOpenAnswer={h.onOpenAnswer}
          myUri={p.myUri}
        />
      ) : null}
      {d.sigReq ? (
        <SigRequestCard req={d.sigReq} dark={p.dark} signing={p.signing} onSign={h.onSign} consentAllowed={p.consentAllowed} />
      ) : null}
      {d.sigRef ? <SigReferenceCard ref={d.sigRef} ts={p.entry.ts} dark={p.dark} /> : null}
      {d.txReq ? <TxRequestCard req={d.txReq} dark={p.dark} paying={p.paying} onPay={h.onPay} consentAllowed={p.consentAllowed} /> : null}
      {d.txReceipt ? <TxReceiptCard receipt={d.txReceipt} ts={p.entry.ts} dark={p.dark} /> : null}
      {d.frame ? <FramePreview frame={d.frame} line={p.entry.line} messageId={p.entry.id} consentAllowed={p.consentAllowed} /> : null}
    </>
  );
}

export function BubbleContent({ model, h, fg, sub }: BubbleContentProps): React.ReactElement {
  const { entry, dark, pending, replyPreview, highlight } = model;
  const d = useMemo(() => descriptorsOf(entry), [entry]);
  const cardLinks = useMemo(() => messageCardLinks(entry.text, mdParser), [entry.text]);
  const textSize = d.poll ? 'md' : MESSAGE_BODY.size;
  const mdStyle = useMemo(() => markdownStyles(fg, dark, textSize), [fg, dark, textSize]);
  const markdownProps = useMemo(
    (): MarkdownProps => ({ markdownit: mdParser, onLinkPress: openInBubbleLink, rules: markdownRules, style: mdStyle }),
    [mdStyle],
  );
  return (
    <>
      <Row align="center" justify="start" style={{ alignSelf: 'stretch' }}>
        <Text color="secondary" size="3xs">
          {pending ? 'Sending' : bubbleTimestamp(entry.ts)}
        </Text>
      </Row>
      <ReplyPreview preview={replyPreview} fg={fg} sub={sub} onPress={h.onReplyPreviewPress} />
      <BubbleAttachments atts={d.atts} entryId={entry.id} fg={fg} />
      {d.kind === 'frameAction' ? (
        <FrameActionLine text={entry.text ?? ''} fg={fg} />
      ) : (
        <BubbleMain d={d} entry={entry} fg={fg} call={model.call} highlight={highlight} markdownProps={markdownProps} />
      )}
      <BubbleEmbeds cardLinks={cardLinks} dark={dark} />
      {model.call ? <CallCard record={model.call} line={entry.line} /> : null}
      <BubbleCards d={d} model={model} h={h} />
    </>
  );
}
