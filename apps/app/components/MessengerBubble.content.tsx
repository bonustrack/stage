/** Inner content column of a MessengerBubble — timestamp header, reply preview,
 *  attachments, body text / embeds, and the interactive question/poll/sig/tx
 *  cards + transcription line. Extracted to keep the row component under the cap. */

import { Linking } from 'react-native';

import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import Markdown from 'react-native-markdown-display';
import { YouTubeEmbed, LocationEmbed } from './MediaEmbeds';
import { ChannelCard } from './ChannelCard';
import { GitHubLinkCard } from './GitHubLinkCard';
import { PreviewLinkCard } from './PreviewLinkCard';
import { mapCoordsOf, youtubeIdOf } from '../lib/embedDetect';
import { githubLinkOf } from '../lib/githubDetect';
import { previewLinkOf } from '../lib/previewLinkDetect';
import { metroConvIdOf, metroDmPeerOf } from '../modules/messaging';
import { Box, Row } from './layout';
import type { HistoryEntry } from '../lib/types';
import {
  hasMention, fmtTs, attachmentsOf, mdParser, markdownStyles,
  questionOf, pollOf, sigRequestOf, sigReferenceOf, txRequestOf, txReceiptOf,
} from './MessengerBubble.helpers';
import { AttachmentView, RemoteAttachmentResolver } from './MessengerBubble.attachments';
import { MentionBody, QuestionView } from './MessengerBubble.parts';
import { PollView } from './MessengerBubble.poll';
import { SigRequestCard, SigReferenceCard, TxRequestCard, TxReceiptCard } from './MessengerBubble.cards';

export function BubbleContent({
  entry, dark, pending, fg, sub, replyPreview, onReplyPreviewPress, transcript,
  onAnswer, votes, ownVotes, onVote, openAnswers, onOpenAnswer, myUri,
  onPay, paying, onSign, signing, selectable,
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
  /** When true, render the body in a plain selectable <Text> so OS text-selection
   *  handles appear for partial copy (Markdown's nested Texts don't select cleanly). */
  selectable?: boolean;
}): React.ReactElement {
  const atts = attachmentsOf(entry);
  const question = questionOf(entry);
  const poll = pollOf(entry);
  const sigReq = sigRequestOf(entry);
  const sigRef = sigReferenceOf(entry);
  const txReq = txRequestOf(entry);
  const txReceipt = txReceiptOf(entry);
  const markdownProps = {
    markdownit: mdParser,
    onLinkPress: (url: string): boolean => { void Linking.openURL(url); return false; },
    /** Discord-style: all messages render with the same typography regardless of sender. */
    style: markdownStyles(fg, dark, false),
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
        /** A message whose entire body is a metro channel link renders as the card
         *  alone (no raw URL); links mixed into other text keep the text + card. */
        (() => {
          const t = entry.text.trim();
          const dmPeer = metroDmPeerOf(t);
          const cid = metroConvIdOf(t);
          // Whole-body channel/DM link → render the card alone (no raw URL).
          const preview = previewLinkOf(t);
          const isBareLink = (dmPeer && t === `metro://xmtp/user/${dmPeer}`)
            || (cid && t === `metro://xmtp/${cid}`)
            || (preview != null && t === preview.url);
          return isBareLink;
        })() ? null : (
          <Box style={{ alignSelf: 'stretch' }}>
            {selectable
              ? <Text size="3xl" selectable color={fg} style={{ lineHeight: 23 }}>{entry.text}</Text>
              : hasMention(entry.text)
                ? <MentionBody text={entry.text} fg={fg} dark={dark} />
                : <Markdown {...markdownProps}>{entry.text}</Markdown>}
          </Box>
        )
      ) : null}
      {/** Inline embeds — metro channel card + YouTube + location, below the text so a URL stays tappable. */}
      {(() => {
        const dmPeer = metroDmPeerOf(entry.text);
        if (dmPeer) return <Box margin={{ top: 6 }} style={{ alignSelf: 'stretch' }}><ChannelCard peerAddress={dmPeer} dark={dark} /></Box>;
        const convId = metroConvIdOf(entry.text);
        if (convId) return <Box margin={{ top: 6 }} style={{ alignSelf: 'stretch' }}><ChannelCard convId={convId} dark={dark} /></Box>;
        const ytId = youtubeIdOf(entry.text);
        if (ytId) return <Box margin={{ top: 6 }} style={{ alignSelf: 'stretch' }}><YouTubeEmbed videoId={ytId} dark={dark} /></Box>;
        const coords = mapCoordsOf(entry.text);
        if (coords) return <Box margin={{ top: 6 }} style={{ alignSelf: 'stretch' }}><LocationEmbed lat={coords.lat} lng={coords.lng} sourceUrl={coords.sourceUrl} dark={dark} /></Box>;
        const gh = githubLinkOf(entry.text);
        if (gh) return <Box margin={{ top: 6 }} style={{ alignSelf: 'stretch' }}><GitHubLinkCard url={gh.url} dark={dark} /></Box>;
        const preview = previewLinkOf(entry.text);
        if (preview) return <Box margin={{ top: 6 }} style={{ alignSelf: 'stretch' }}><PreviewLinkCard url={preview.url} dark={dark} /></Box>;
        return null;
      })()}
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
        <SigRequestCard req={sigReq} dark={dark} sub={sub} signing={signing} onSign={onSign} />
      ) : null}
      {sigRef ? (
        <SigReferenceCard ref={sigRef} dark={dark} sub={sub} />
      ) : null}
      {txReq ? (
        <TxRequestCard req={txReq} dark={dark} sub={sub} paying={paying} onPay={onPay} />
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
