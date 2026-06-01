/** Inner content column of a MessengerBubble — timestamp header, reply preview,
 *  attachments, body text / embeds, and the interactive question/poll/sig/tx
 *  cards + transcription line. Extracted to keep the row component under the cap. */

import { Linking, Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import Markdown from 'react-native-markdown-display';
import { YouTubeEmbed, LocationEmbed } from './MediaEmbeds';
import { mapCoordsOf, youtubeIdOf } from '../lib/embedDetect';
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
  onAnswer, votes, ownVotes, onVote, onPay, paying, onSign, signing,
}: {
  entry: HistoryEntry; dark: boolean; pending?: boolean; fg: string; sub: string;
  replyPreview?: string; onReplyPreviewPress?: () => void; transcript?: string;
  onAnswer?: (label: string) => void;
  votes?: Map<number, Set<string>>; ownVotes?: Set<number>;
  onVote?: (optionIndex: number, action: 'added' | 'removed') => void;
  onPay?: () => void; paying?: boolean; onSign?: () => void; signing?: boolean;
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
        <Text style={{ color: sub, fontSize: 11 , fontFamily: 'Calibre-Medium'}}>{pending ? 'Sending' : fmtTs(entry.ts)}</Text>
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
          <Text style={{ color: fg, fontSize: 14, fontStyle: 'italic' , fontFamily: 'Calibre-Medium'}} numberOfLines={2}>
            {replyPreview}
          </Text>
        </Pressable>
      ) : null}
      {atts.length > 0 ? <Box style={{ alignSelf: 'stretch' }}>{atts.map((a, i) => {
        /** XMTP inline attachments carry bytes in `dataB64` — render via data: URI.
         *  Optimistic (pending) attachments carry the local `file://` URI so the
         *  image shows instantly while the send is in flight; full `http(s)`/
         *  `data:` URIs render as-is. */
        const key = a.id ?? `${entry.id}-att-${i}`;
        /** Multi-remote attachments carry encrypted bytes on IPFS — resolve lazily. */
        if (a.remote) {
          return <RemoteAttachmentResolver key={key} att={a} fg={fg} sub={sub} dark={dark} />;
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
        <Box style={{ alignSelf: 'stretch' }}>
          {hasMention(entry.text)
            ? <MentionBody text={entry.text} fg={fg} dark={dark} />
            : <Markdown {...markdownProps}>{entry.text}</Markdown>}
        </Box>
      ) : null}
      {/** Inline embeds — YouTube + location, below the text so the URL stays tappable. */}
      {(() => {
        const ytId = youtubeIdOf(entry.text);
        if (ytId) return <Box style={{ alignSelf: 'stretch', marginTop: 6 }}><YouTubeEmbed videoId={ytId} dark={dark} /></Box>;
        const coords = mapCoordsOf(entry.text);
        if (coords) return <Box style={{ alignSelf: 'stretch', marginTop: 6 }}><LocationEmbed lat={coords.lat} lng={coords.lng} sourceUrl={coords.sourceUrl} dark={dark} /></Box>;
        return null;
      })()}
      {question && onAnswer ? (
        <QuestionView question={question} dark={dark} sub={sub} onAnswer={onAnswer} />
      ) : null}
      {poll && onVote ? (
        <PollView poll={poll} dark={dark} sub={sub} votes={votes} ownVotes={ownVotes} onVote={onVote} />
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
        <Text style={{
          color: sub, opacity: 0.85, fontSize: 13, fontStyle: 'italic',
          marginTop: atts.length ? 4 : 0,
        }}>“{transcript}”</Text>
      ) : atts.some(a => a.kind === 'audio') && Date.now() - new Date(entry.ts).getTime() < 30_000 ? (
        /** Fresh audio bubble + transcription still running; old audio gets nothing. */
        <Text style={{ color: sub, opacity: 0.6, fontSize: 13, fontStyle: 'italic', marginTop: 4 , fontFamily: 'Calibre-Medium'}}>
          transcribing…
        </Text>
      ) : null}
    </>
  );
}
