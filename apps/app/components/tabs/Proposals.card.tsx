/** @file Proposals.card — the single active pending-request card, dispatching on the queued request's kind (poll/payment/signing/message) to reuse the chat view's vote/pay/sign pipelines, with Skip + Open advancing to the next request. */

import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { Button } from '@stage-labs/kit/button';
import { Text } from '@stage-labs/kit/text';
import type { SignatureRequestContent } from '@stage-labs/client/xmtp/sign';
import type { WalletSendCallsContent } from '@stage-labs/client/xmtp/tx';
import { Box, Row, Col } from '../layout';
import { Avatar } from '../Avatar';
import { ChannelRow } from '../ChannelRow';
import { MessengerComposer } from '../MessengerComposer';
import { useConversationState } from '../xmtp-conv/useConversationState';
import { pollOf, txRequestOf, sigRequestOf, fmtTs } from '../MessengerBubble.helpers';
import { PollView } from '../MessengerBubble.poll';
import { TxRequestCard, SigRequestCard } from '../MessengerBubble.cards';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { getPeerName } from '../../lib/peerProfiles';
import { shortAddress, acceptRequestConv, blockRequestConv, getCachedXmtpClient } from '../../modules/messaging';
import type { QueuedRequest, RequestKind } from './Proposals.queue';

/** Human label for each request kind, shown as the card-header eyebrow so the type is clear at a glance ("Poll" / "Payment request" / …). */
const KIND_LABEL: Record<RequestKind, string> = {
  poll: 'Poll',
  payment: 'Payment request',
  signing: 'Signing request',
  message: 'Message request',
};

/** Small uppercase type eyebrow above the card title. Uses kit text tokens (secondary role, smallest step) so it stays minimal and theme-aware. */
function KindEyebrow({ kind }: { kind: RequestKind }): React.ReactElement {
  return (
    <Text role="secondary" size="2xs" weight="semibold"
      style={{ textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
      {KIND_LABEL[kind]}
    </Text>
  );
}

/** Top-level dispatcher: route to the right card by request kind. */
export function ProposalCard({ proposal, onAdvance }: {
  proposal: QueuedRequest;
  /** Advance to the next request (Skip, or after acting on this one). */
  onAdvance: () => void;
}): React.ReactElement {
  if (proposal.kind === 'message') return <MessageRequestCard request={proposal} onAdvance={onAdvance}/>;
  return <ConversationRequestCard proposal={proposal} onAdvance={onAdvance}/>;
}

/** Header shared by the conversation-backed cards: channel title + (for the source message) author + posted-at, matching the chat sender resolution. */
function CardHeader({ kind, title, authorAddr, authorName, postedAt, fg }: {
  kind: RequestKind; title: string; authorAddr: string | null; authorName: string | null;
  postedAt: string | null; fg: string;
}): React.ReactElement {
  const pal = usePalette();
  return (
    <>
      <KindEyebrow kind={kind}/>
      <Text weight="semibold" size="4xl" color={pal.link} numberOfLines={1}>
        {title}
      </Text>
      {authorName ? (
        <Row gap={6} align="center" margin={{ top: 8 }}>
          <Avatar address={authorAddr} size="sm"/>
          <Text weight="medium" size="sm" color={fg} numberOfLines={1}>{authorName}</Text>
          {postedAt ? <Text size="xs" role="secondary">· {postedAt}</Text> : null}
        </Row>
      ) : null}
    </>
  );
}

/** Skip / Open-channel control row, shared by every card. */
function ControlRow({ onSkip, onOpen, dark, hint }: {
  onSkip: () => void; onOpen: () => void; dark: boolean; hint?: string;
}): React.ReactElement {
  return (
    <>
      <Row gap={10} margin={{ top: 16 }} style={{ alignSelf: 'stretch' }}>
        <Box flex={1}>
          <Button block variant="secondary" size="md" dark={dark} onPress={onSkip} label="Skip"/>
        </Box>
        <Box flex={1}>
          <Button block variant="ghost" size="md" dark={dark} onPress={onOpen} label="Open channel"/>
        </Box>
      </Row>
      {hint ? (
        <Text size="xs" role="secondary" style={{ marginTop: 10, opacity: 0.7 }}>
          {hint}
        </Text>
      ) : null}
    </>
  );
}

/** Resolve the author name + posted-at line for the card header from the source entry. */
function headerFields(authorAddr: string | null, ts: string | undefined): { authorName: string | null; postedAt: string | null } {
  return {
    authorName: authorAddr ? (getPeerName(authorAddr) ?? shortAddress(authorAddr)) : null,
    postedAt: ts ? fmtTs(ts) : null,
  };
}

/** Resolve the channel title for a conversation request (group name or peer name/address). */
function conversationTitle(isGroup: boolean, groupName: string | null | undefined, peerAddr: string | null): string {
  if (isGroup) return groupName?.trim() ? groupName.trim() : 'Untitled group';
  return peerAddr ? (getPeerName(peerAddr) ?? shortAddress(peerAddr)) : '';
}

/** Control-row hint for a conversation request kind, or undefined while loading. */
function controlHint(kind: RequestKind, loading: boolean): string | undefined {
  if (loading) return undefined;
  if (kind === 'poll') return 'Tap an option to vote, or send a custom message below.';
  if (kind === 'payment') return 'Tap Pay to confirm, or send a custom message below.';
  return 'Tap Sign to confirm, or send a custom message below.';
}

/** Renders the request body: PollView / TxRequestCard / SigRequestCard, or a loading line. */
function RequestBody({ proposal, c, msgId, dark, sub, onPayPress, onSignPress }: {
  proposal: QueuedRequest; c: ReturnType<typeof useConversationState>; msgId: string;
  dark: boolean; sub: string; onPayPress: () => void; onSignPress: () => void;
}): React.ReactElement {
  const entry = c.events.find(e => e.id === msgId);
  const poll = entry ? pollOf(entry) : undefined;
  const tx = entry ? txRequestOf(entry) : undefined;
  const sig = entry ? sigRequestOf(entry) : undefined;
  const kindLabel = proposal.kind === 'payment' ? 'payment request'
    : proposal.kind === 'signing' ? 'signature request' : 'proposal';
  if (poll) {
    return (
      <PollView
        poll={poll} dark={dark} sub={sub}
        votes={c.displayVotes.get(msgId)} ownVotes={c.displayOwnVotes.get(msgId)}
        onVote={(q, o, action) => { c.onVote(msgId, q, o, action); }}
        openAnswers={c.displayOpenAnswers.get(msgId)}
        onOpenAnswer={(q, text) => { c.onOpenAnswer(msgId, q, text); }}
        myUri={c.myUri}
      />
    );
  }
  if (tx) return <TxRequestCard req={tx} dark={dark} sub={sub} paying={c.payingIds.has(msgId)} onPay={onPayPress} />;
  if (sig) return <SigRequestCard req={sig} dark={dark} sub={sub} signing={c.signingIds.has(msgId)} onSign={onSignPress} />;
  return <Text role="secondary" style={{ marginTop: 12 }}>Loading {kindLabel}…</Text>;
}

/** Poll / payment / signing card: mounts the conversation and renders the request body wired to the chat's vote/pay/sign pipeline. */
function ConversationRequestCard({ proposal, onAdvance }: {
  proposal: QueuedRequest; onAdvance: () => void;
}): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const fg = pal.text, sub = pal.text;
  const msgId = proposal.msgId ?? '';

  const c = useConversationState(proposal.convId, undefined);
  /** The source message, re-found in the live feed so tally / spinners stay live. */
  const entry = useMemo(() => c.events.find(e => e.id === msgId), [c.events, msgId]);
  const title = conversationTitle(c.isGroup, c.groupName, c.peerAddr);
  const authorAddr = useMemo(() => (entry ? c.senderEthOf(entry.from) : null), [entry, c]);
  const header = headerFields(authorAddr, entry?.ts);

  const openChannel = useCallback(() => {
    router.push({ pathname: '/xmtp/[convId]', params: { convId: proposal.convId } });
  }, [router, proposal.convId]);

  /** Pay / sign reuse the chat handlers verbatim, then advance to the next item. */
  const payload = entry?.payload as { walletSendCalls?: WalletSendCallsContent; signatureRequest?: SignatureRequestContent } | undefined;
  const wsc = payload?.walletSendCalls;
  const sigReq = payload?.signatureRequest;
  const { onPay, onSign, onOptimistic, onSent } = c;
  const onPayPress = useCallback(() => { if (wsc) { onPay(msgId, wsc); onAdvance(); } }, [wsc, onPay, msgId, onAdvance]);
  const onSignPress = useCallback(() => { if (sigReq) { onSign(msgId, sigReq); onAdvance(); } }, [sigReq, onSign, msgId, onAdvance]);
  const onComposerOptimistic = useCallback((entryArg: Parameters<NonNullable<typeof onOptimistic>>[0]) => {
    onOptimistic?.(entryArg);
    onAdvance();
  }, [onOptimistic, onAdvance]);

  const poll = entry ? pollOf(entry) : undefined;
  return (
    <Col flex={1} surface="surface">
      <Box flex={1} padding={{ x: 16, top: 16 }} style={{ alignSelf: 'stretch' }}>
        <CardHeader kind={proposal.kind} title={title} authorAddr={authorAddr} authorName={header.authorName} postedAt={header.postedAt} fg={fg}/>
        {poll?.question ? (
          <Text weight="semibold" size="4xl" color={fg} style={{ marginTop: 6 }}>{poll.question}</Text>
        ) : null}
        <RequestBody proposal={proposal} c={c} msgId={msgId} dark={dark} sub={sub} onPayPress={onPayPress} onSignPress={onSignPress} />
        <ControlRow onSkip={onAdvance} onOpen={openChannel} dark={dark} hint={controlHint(proposal.kind, !entry)} />
      </Box>
      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <MessengerComposer
          dark={dark} xmtpLine={c.activeLine} mentionCandidates={c.mentionCandidates}
          onOptimistic={onComposerOptimistic} onSent={onSent}
        />
        <Box height={insets.bottom} surface="raised"/>
      </KeyboardStickyView>
    </Col>
  );
}

/** Resolve the display title for a message-request channel preview. */
function requestTitle(view: QueuedRequest['request']): string {
  if (!view) return '';
  return view.peerAddress ? (getPeerName(view.peerAddress) ?? view.title) : view.title;
}

/** Message-request card: a compact channel preview with Accept / Block + Open. Channel-level; acting advances to the next item. */
function MessageRequestCard({ request, onAdvance }: {
  request: QueuedRequest; onAdvance: () => void;
}): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const view = request.request;
  const displayTitle = requestTitle(view);

  const openChannel = useCallback(() => {
    router.push({ pathname: '/xmtp/[convId]', params: { convId: request.convId } });
  }, [router, request.convId]);

  /** Accept / Block reuse the exact requests-list handlers; either resolves the request, so advance optimistically (the consent write + sync reconcile the channels list + other devices). */
  const act = useCallback((accept: boolean) => {
    void (accept ? acceptRequestConv(request.convId) : blockRequestConv(request.convId))
      .then(() => {
        void (getCachedXmtpClient() as unknown as { preferences?: { syncConsent?: () => Promise<unknown> } })
          ?.preferences?.syncConsent?.();
      })
      .catch(() => { /* best-effort; a failed write just leaves it for next rescan */ });
    onAdvance();
  }, [request.convId, onAdvance]);

  return (
    <Col flex={1} surface="surface">
      <Box flex={1} padding={{ x: 16, top: 16 }} style={{ alignSelf: 'stretch' }}>
        <KindEyebrow kind="message"/>
        <Text weight="semibold" size="4xl" color={pal.link} numberOfLines={1}>
          Message request
        </Text>
        <Box margin={{ top: 12 }} style={{ alignSelf: 'stretch' }}>
          <ChannelRow
            title={displayTitle}
            avatarAddress={view?.avatarAddress ?? null}
            avatarUri={view?.avatarUri ?? null}
            square={view?.isGroup}
            lastPreview={view?.preview == null || view.preview === '' ? '(no messages yet)' : view.preview}
            onPress={openChannel}
          />
        </Box>

        <Row gap={10} margin={{ top: 16 }} style={{ alignSelf: 'stretch' }}>
          <Box flex={1}>
            <Button block variant="danger" size="md" dark={dark} onPress={() => { act(false); }} label="Block"
              tintBg={pal.danger} tintFg={pal.bg}/>
          </Box>
          <Box flex={1}>
            <Button block variant="primary" size="md" dark={dark} onPress={() => { act(true); }} label="Accept"
              tintBg={pal.link} tintFg={pal.bg}/>
          </Box>
        </Row>
        <ControlRow onSkip={onAdvance} onOpen={openChannel} dark={dark}/>
      </Box>
    </Col>
  );
}
