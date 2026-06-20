/** @file Inner content column of a MessengerBubble — timestamp header, reply preview, attachments, body text/embeds, interactive question/poll/sig/tx cards, and transcription line. */

import { useMemo } from 'react';
import { openInBubbleLink } from '../lib/safeOpenLink';

import { Text } from '@metro-labs/kit/text';
import Markdown from 'react-native-markdown-display';
import { cardLinksOf } from '../lib/cardLinks';
import { Box, Row } from './layout';
import type { HistoryEntry } from '../lib/types';
import {
  fmtTs, attachmentsOf, mdParser, markdownStyles,
  questionOf, pollOf, sigRequestOf, sigReferenceOf, txRequestOf, txReceiptOf,
} from './MessengerBubble.helpers';
import { QuestionView } from './MessengerBubble.parts';
import { PollView } from './MessengerBubble.poll';
import { SigRequestCard, SigReferenceCard, TxRequestCard, TxReceiptCard } from './MessengerBubble.cards';
import {
  BubbleAttachments, BubbleBody, BubbleEmbeds, ReplyPreview, TranscriptLine, type MarkdownProps,
} from './MessengerBubble.content.parts';

/** Parse the payload descriptors of an entry once (detectors are memoized by caller). */
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

/** Props consumed by BubbleContent. */
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
  /** XMTP consent of the conv: `false` (stranger) disables Sign/Pay on cards. */
  consentAllowed?: boolean;
  /** When true, render the body in a plain selectable <Text> so OS text-selection handles appear for partial copy (Markdown's nested Texts don't select cleanly). */
  selectable?: boolean;
  /** Search mode: case-insensitive occurrences of this query in the body get a fluo-yellow highlight (renders the body via HighlightText instead of Markdown). Undefined/empty in the normal feed. */
  highlight?: string;
}

/** Renders the main body region: poll question, transaction placeholder, or message text. */
function BubbleMain({ d, entry, fg, dark, selectable, highlight, markdownProps }: {
  d: ReturnType<typeof descriptorsOf>; entry: HistoryEntry; fg: string; dark: boolean;
  selectable?: boolean; highlight?: string; markdownProps: MarkdownProps;
}): React.ReactElement | null {
  /** Poll bubble surfaces only the question here; PollView shows the options. */
  if (d.poll) {
    return d.poll.question ? (
      <Box style={{ alignSelf: 'stretch' }}><Markdown {...markdownProps}>{d.poll.question}</Markdown></Box>
    ) : null;
  }
  /** Transaction bubbles render an interactive card instead of raw fallback text. */
  if (d.txReq || d.txReceipt) return null;
  /** Always render the body text, even for a lone-link share: the cards below are an addition, not a replacement, so the shared url still shows (card stacks beneath). */
  if (!entry.text) return null;
  return <BubbleBody text={entry.text} fg={fg} dark={dark} selectable={selectable} highlight={highlight} markdownProps={markdownProps} />;
}

/** Renders the interactive cards (question, poll, sig, tx, receipt) for a bubble. */
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
        <SigRequestCard req={d.sigReq} dark={p.dark} sub={p.sub} signing={p.signing} onSign={p.onSign} consentAllowed={p.consentAllowed} />
      ) : null}
      {d.sigRef ? <SigReferenceCard ref={d.sigRef} dark={p.dark} sub={p.sub} /> : null}
      {d.txReq ? (
        <TxRequestCard req={d.txReq} dark={p.dark} sub={p.sub} paying={p.paying} onPay={p.onPay} consentAllowed={p.consentAllowed} />
      ) : null}
      {d.txReceipt ? <TxReceiptCard receipt={d.txReceipt} dark={p.dark} /> : null}
    </>
  );
}

/** Renders a bubble's inner content column: header, reply preview, attachments, body, and interactive cards. */
export function BubbleContent(props: BubbleContentProps): React.ReactElement {
  const { entry, dark, pending, fg, sub, replyPreview, onReplyPreviewPress, transcript, selectable, highlight } = props;
  /** Parse the payload descriptors once per entry instead of re-running every detector on every render (a reaction/vote tick elsewhere re-renders bubbles). */
  const d = useMemo(() => descriptorsOf(entry), [entry]);
  /** Card links re-parsed only when the body text changes (keyed on entry.text). */
  const cardLinks = useMemo(() => cardLinksOf(entry.text), [entry.text]);
  /** markdownStyles builds a fresh nested style object; cache it per [fg,dark]. */
  const mdStyle = useMemo(() => markdownStyles(fg, dark, false), [fg, dark]);
  const markdownProps: MarkdownProps = {
    markdownit: mdParser,
    onLinkPress: (url: string): boolean => openInBubbleLink(url),
    /** Discord-style: all messages render with the same typography regardless of sender. */
    style: mdStyle,
  };
  return (
    <>
      <Row align="center" justify="start" style={{ alignSelf: 'stretch' }}>
        <Text size="3xs" color={sub}>{pending ? 'Sending' : fmtTs(entry.ts)}</Text>
      </Row>
      <ReplyPreview preview={replyPreview} fg={fg} sub={sub} onPress={onReplyPreviewPress} />
      <BubbleAttachments atts={d.atts} entryId={entry.id} fg={fg} sub={sub} dark={dark} />
      <BubbleMain d={d} entry={entry} fg={fg} dark={dark} selectable={selectable} highlight={highlight} markdownProps={markdownProps} />
      <BubbleEmbeds cardLinks={cardLinks} dark={dark} />
      <BubbleCards d={d} p={props} />
      <TranscriptLine transcript={transcript} atts={d.atts} entryTs={entry.ts} sub={sub} />
    </>
  );
}
