/** Inner content column of a MessengerBubble — timestamp header, reply preview,
 *  attachments, body text / embeds, and the interactive question/poll/sig/tx
 *  cards + transcription line. Extracted to keep the row component under the cap. */

import { useMemo } from 'react';
import { openInBubbleLink } from '../lib/safeOpenLink';

import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import Markdown from 'react-native-markdown-display';
import { YouTubeEmbed, LocationEmbed } from './MediaEmbeds';
import { ChannelCard } from './ChannelCard';
import { GitHubLinkCard } from './GitHubLinkCard';
import { PreviewLinkCard } from './PreviewLinkCard';
import { LinkPreviewCard } from './LinkPreviewCard';
import { cardLinksOf } from '../lib/cardLinks';
import { Box, Row } from './layout';
import type { HistoryEntry } from '../lib/types';
import {
  hasMention, fmtTs, attachmentsOf, mdParser, markdownStyles, unescapeBody,
  questionOf, pollOf, sigRequestOf, sigReferenceOf, txRequestOf, txReceiptOf,
} from './MessengerBubble.helpers';
import { AttachmentView, RemoteAttachmentResolver } from './MessengerBubble.attachments';
import { MentionBody, QuestionView } from './MessengerBubble.parts';
import { HighlightText } from './HighlightText';
import { PollView } from './MessengerBubble.poll';
import { SigRequestCard, SigReferenceCard, TxRequestCard, TxReceiptCard } from './MessengerBubble.cards';

export function BubbleContent({
  entry, dark, pending, fg, sub, replyPreview, onReplyPreviewPress, transcript,
  onAnswer, votes, ownVotes, onVote, openAnswers, onOpenAnswer, myUri,
  onPay, paying, onSign, signing, consentAllowed, selectable, highlight,
}: {
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
  /** When true, render the body in a plain selectable <Text> so OS text-selection
   *  handles appear for partial copy (Markdown's nested Texts don't select cleanly). */
  selectable?: boolean;
  /** Search mode: case-insensitive occurrences of this query in the body get a
   *  fluo-yellow highlight (renders the body via HighlightText instead of
   *  Markdown). Undefined/empty in the normal feed. */
  highlight?: string;
}): React.ReactElement {
  /** Parse the payload descriptors ONCE per entry instead of re-running every
   *  detector (+ pollOf's normalizeQuestions) on every render. A reaction/vote
   *  tick elsewhere in the feed used to re-run all of these for every bubble. */
  const { atts, question, poll, sigReq, sigRef, txReq, txReceipt } = useMemo(() => ({
    atts: attachmentsOf(entry),
    question: questionOf(entry),
    poll: pollOf(entry),
    sigReq: sigRequestOf(entry),
    sigRef: sigReferenceOf(entry),
    txReq: txRequestOf(entry),
    txReceipt: txReceiptOf(entry),
  }), [entry]);
  /** Card links re-parsed only when the body text changes (keyed on entry.text). */
  const cardLinks = useMemo(() => cardLinksOf(entry.text), [entry.text]);
  /** markdownStyles builds a fresh nested style object; cache it per [fg,dark]. */
  const mdStyle = useMemo(() => markdownStyles(fg, dark, false), [fg, dark]);
  const markdownProps = {
    markdownit: mdParser,
    onLinkPress: (url: string): boolean => openInBubbleLink(url),
    /** Discord-style: all messages render with the same typography regardless of sender. */
    style: mdStyle,
  };
  return (
    <>
      {/** Timestamp / "Sending" header above the body. */}
      <Row align="center" justify="start" style={{ alignSelf: 'stretch' }}>
        <Text size="3xs" color={sub}>{pending ? 'Sending' : fmtTs(entry.ts)}</Text>
      </Row>
      {replyPreview ? (
        <Pressable
          onPress={onReplyPreviewPress}
          disabled={!onReplyPreviewPress}
          style={({ pressed }) => ({
            alignSelf: 'stretch', borderLeftWidth: 2, borderLeftColor: sub,
            paddingLeft: 6, marginBottom: 4, opacity: pressed ? 0.45 : 0.7,
          })}
        >
          <Text size="xl" color={fg} numberOfLines={2}>
            {replyPreview}
          </Text>
        </Pressable>
      ) : null}
      {atts.length> 0 ? <Box style={{ alignSelf: 'stretch' }}>{atts.map((a, i) => {
        /** XMTP inline attachments carry bytes in `dataB64` — render via data: URI.
         *  Optimistic (pending) attachments carry the local `file://` URI so the
         *  image shows instantly while the send is in flight; full `http(s)`/
         *  `data:` URIs render as-is. */
        const key = a.id ?? `${entry.id}-att-${i}`;
        /** Multi-remote attachments carry encrypted bytes on IPFS — resolve lazily. */
        if (a.remote) {
          return <RemoteAttachmentResolver key={key} att={a} fg={fg} sub={sub} dark={dark} msgId={entry.id} index={i} />;
        }
        const fullUrl = a.dataB64
          ? `data:${a.mime ?? 'application/octet-stream'};base64,${a.dataB64}`
          : a.url ?? '';
        return (
          <AttachmentView key={key} att={a} fg={fg} fullUrl={fullUrl} dark={dark} />
        );
      })}</Box> : null}
      {/** Poll bubble surfaces only the question here; PollView shows the options. */}
      {poll ? (
        poll.question ? (
          <Box style={{ alignSelf: 'stretch' }}>
            <Markdown {...markdownProps}>{poll.question}</Markdown>
          </Box>
        ) : null
      ) : (txReq || txReceipt) ? (
        /** Transaction bubbles render an interactive card instead of raw fallback text. */
        null
      ) : entry.text ? (
        /** Always render the body text, even when the whole message is a single
         *  shared link: the cards below are an ADDITION, not a replacement, so a
         *  lone-link share still shows the url it shared (then its card stacks
         *  beneath). Mixed text + links already kept both. */
        (() => {
          /** Repair line breaks delivered as the literal 2-char `\n` (escaped by
           *  a sender that JSON-stringified the body) so they render as real
           *  breaks. Lossless for normal messages (no-op fast path). */
          const body = unescapeBody(entry.text);
          return (
            <Box style={{ alignSelf: 'stretch' }}>
              {highlight && highlight.trim()
                ? <HighlightText text={body} query={highlight} fg={fg} />
                : selectable
                  ? <Text size="3xl" selectable color={fg} style={{ lineHeight: 23 }}>{body}</Text>
                  : hasMention(body)
                    ? <MentionBody text={body} fg={fg} dark={dark} />
                    : <Markdown {...markdownProps}>{body}</Markdown>}
            </Box>
          );
        })()
      ) : null}
      {/** Inline embeds — one card per card-generating link in the body, stacked
       *  below the text (in appearance order, deduped) so each URL stays tappable.
       *  Capped at MAX_CARDS; extra links remain plain text. */}
      {cardLinks.map(card => {
        const node = card.kind === 'dm' ? <ChannelCard peerAddress={card.peerAddress} dark={dark} />
          : card.kind === 'channel' ? <ChannelCard convId={card.convId} dark={dark} />
          : card.kind === 'youtube' ? <YouTubeEmbed videoId={card.videoId} dark={dark} />
          : card.kind === 'map' ? <LocationEmbed lat={card.lat} lng={card.lng} sourceUrl={card.sourceUrl} dark={dark} />
          : card.kind === 'github' ? <GitHubLinkCard url={card.url} dark={dark} />
          : card.kind === 'preview' ? <PreviewLinkCard url={card.url} dark={dark} />
          : <LinkPreviewCard url={card.url} dark={dark} />;
        return (
          <Box key={`${card.kind}:${card.url}`} margin={{ top: 6 }} style={{ alignSelf: 'stretch' }}>
            {node}
          </Box>
        );
      })}
      {question && onAnswer ? (
        <QuestionView question={question} dark={dark} sub={sub} onAnswer={onAnswer} />
      ) : null}
      {poll && onVote ? (
        <PollView
          poll={poll} dark={dark} sub={sub} votes={votes} ownVotes={ownVotes} onVote={onVote}
          openAnswers={openAnswers} onOpenAnswer={onOpenAnswer} myUri={myUri}
        />
      ) : null}
      {sigReq ? (
        <SigRequestCard req={sigReq} dark={dark} sub={sub} signing={signing} onSign={onSign} consentAllowed={consentAllowed} />
      ) : null}
      {sigRef ? (
        <SigReferenceCard ref={sigRef} dark={dark} sub={sub} />
      ) : null}
      {txReq ? (
        <TxRequestCard req={txReq} dark={dark} sub={sub} paying={paying} onPay={onPay} consentAllowed={consentAllowed} />
      ) : null}
      {txReceipt ? (
        <TxReceiptCard receipt={txReceipt} dark={dark} />
      ) : null}
      {transcript ? (
        <Text size="xs" color={sub} style={{ opacity: 0.85, fontStyle: 'italic', marginTop: atts.length ? 4 : 0 }}>“{transcript}”</Text>
      ) : atts.some(a => a.kind === 'audio') && Date.now() - new Date(entry.ts).getTime() < 30_000 ? (
        /** Fresh audio bubble + transcription still running; old audio gets nothing. */
        <Text size="xs" color={sub} style={{ opacity: 0.6, fontStyle: 'italic', marginTop: 4 }}>
          transcribing…
        </Text>
      ) : null}
    </>
  );
}
