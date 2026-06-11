/** The single active pending-request card on the Pending requests page.
 *
 *  Dispatches on the queued request's `kind`:
 *   - poll     → PollRequestCard: the live poll tally + vote, reusing the chat
 *                view's vote pipeline (useConversationState → useVotesLayer).
 *   - payment  → TxPayCard: the SAME TxRequestCard the chat renders, wired to the
 *                conversation's Pay flow (confirm + own-balance via useTxSignLayer).
 *   - signing  → SigSignCard: the SAME SigRequestCard with its native Sign action.
 *   - message  → MessageRequestCard: a compact channel preview (name + last
 *                message) with Accept / Block (reusing the requests-list consent
 *                handlers) + Open.
 *
 *  The message-level kinds (poll/payment/signing) mount the FULL conversation
 *  machinery for ONE channel via `useConversationState`, so voting / paying /
 *  signing reuse the exact same path (and receipts) as the chat view. The message
 *  kind is channel-level (consent-unknown), so it needs no conversation mount.
 *
 *  Common controls per card: Skip (session) + Open channel. Acting on a request
 *  (vote / pay / sign / accept / block) advances to the next.
 *
 *  Keyed by the request key at the call site so switching requests remounts the
 *  hook cleanly (fresh feed for the next channel). */

import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { Button } from '@metro-labs/kit/button';
import { Text } from '@metro-labs/kit/text';
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
import type { QueuedRequest } from './Proposals.queue';

/** Top-level dispatcher: route to the right card by request kind. */
export function ProposalCard({ proposal, onAdvance }: {
  proposal: QueuedRequest;
  /** Advance to the next request (Skip, or after acting on this one). */
  onAdvance: () => void;
}): React.ReactElement {
  if (proposal.kind === 'message') return <MessageRequestCard request={proposal} onAdvance={onAdvance}/>;
  return <ConversationRequestCard proposal={proposal} onAdvance={onAdvance}/>;
}

/** Header shared by the conversation-backed cards: channel title + (for the
 *  source message) author + posted-at, matching the chat sender resolution. */
function CardHeader({ title, authorAddr, authorName, postedAt, fg }: {
  title: string; authorAddr: string | null; authorName: string | null;
  postedAt: string | null; fg: string;
}): React.ReactElement {
  const pal = usePalette();
  return (
    <>
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

/** Poll / payment / signing card: mounts the conversation for one channel and
 *  renders the request body (PollView / TxRequestCard / SigRequestCard) wired to
 *  the same vote/pay/sign pipeline the chat uses. */
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
  const {
    activeLine, events, myUri, isGroup, groupName, peerAddr,
    mentionCandidates, displayVotes, displayOwnVotes, onVote,
    displayOpenAnswers, onOpenAnswer, onOptimistic, onSent,
    senderEthOf, onPay, payingIds, onSign, signingIds,
  } = c;

  /** The source message itself - re-found in the live feed by the queued id so
   *  the poll tally / pay+sign spinners stay live. */
  const entry = useMemo(() => events.find(e => e.id === msgId), [events, msgId]);
  const poll = entry ? pollOf(entry) : undefined;
  const tx = entry ? txRequestOf(entry) : undefined;
  const sig = entry ? sigRequestOf(entry) : undefined;

  const title = isGroup
    ? (groupName?.trim() || 'Untitled group')
    : (peerAddr ? (getPeerName(peerAddr) ?? shortAddress(peerAddr)) : '');

  const authorAddr = useMemo(
    () => (entry ? senderEthOf(entry.from) : null),
    [entry, senderEthOf],
  );
  const authorName = authorAddr ? (getPeerName(authorAddr) ?? shortAddress(authorAddr)) : null;
  const postedAt = entry?.ts ? fmtTs(entry.ts) : null;

  const openChannel = useCallback(() => {
    router.push({ pathname: '/xmtp/[convId]', params: { convId: proposal.convId } });
  }, [router, proposal.convId]);

  /** Pay / sign reuse the chat handlers verbatim, then advance to the next item
   *  (the receipt posts back into the channel via the shared pipeline). */
  const wsc = entry ? (entry.payload as { walletSendCalls?: WalletSendCallsContent } | undefined)?.walletSendCalls : undefined;
  const sigReq = entry ? (entry.payload as { signatureRequest?: SignatureRequestContent } | undefined)?.signatureRequest : undefined;
  const onPayPress = useCallback(() => { if (wsc) { onPay(msgId, wsc); onAdvance(); } }, [wsc, onPay, msgId, onAdvance]);
  const onSignPress = useCallback(() => { if (sigReq) { onSign(msgId, sigReq); onAdvance(); } }, [sigReq, onSign, msgId, onAdvance]);

  const onComposerOptimistic = useCallback((entryArg: Parameters<NonNullable<typeof onOptimistic>>[0]) => {
    onOptimistic?.(entryArg);
    onAdvance();
  }, [onOptimistic, onAdvance]);

  const loading = !entry;
  const kindLabel = proposal.kind === 'payment' ? 'payment request'
    : proposal.kind === 'signing' ? 'signature request' : 'proposal';

  return (
    <Col flex={1} surface="surface">
      <Box flex={1} padding={{ x: 16, top: 16 }} style={{ alignSelf: 'stretch' }}>
        <CardHeader title={title} authorAddr={authorAddr} authorName={authorName} postedAt={postedAt} fg={fg}/>

        {poll?.question ? (
          <Text weight="semibold" size="4xl" color={fg} style={{ marginTop: 6 }}>
            {poll.question}
          </Text>
        ) : null}

        {poll ? (
          <PollView
            poll={poll}
            dark={dark}
            sub={sub}
            votes={displayVotes.get(msgId)}
            ownVotes={displayOwnVotes.get(msgId)}
            onVote={(q, o, action) => { onVote(msgId, q, o, action); }}
            openAnswers={displayOpenAnswers.get(msgId)}
            onOpenAnswer={(q, text) => { onOpenAnswer(msgId, q, text); }}
            myUri={myUri}
          />
        ) : tx ? (
          <TxRequestCard
            req={tx}
            dark={dark}
            sub={sub}
            paying={payingIds.has(msgId)}
            onPay={onPayPress}
          />
        ) : sig ? (
          <SigRequestCard
            req={sig}
            dark={dark}
            sub={sub}
            signing={signingIds.has(msgId)}
            onSign={onSignPress}
          />
        ) : (
          <Text role="secondary" style={{ marginTop: 12 }}>Loading {kindLabel}…</Text>
        )}

        <ControlRow
          onSkip={onAdvance}
          onOpen={openChannel}
          dark={dark}
          hint={loading ? undefined : proposal.kind === 'poll'
            ? 'Tap an option to vote, or send a custom message below.'
            : proposal.kind === 'payment'
              ? 'Tap Pay to confirm, or send a custom message below.'
              : 'Tap Sign to confirm, or send a custom message below.'}
        />
      </Box>
      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <MessengerComposer
          dark={dark}
          xmtpLine={activeLine}
          mentionCandidates={mentionCandidates}
          onOptimistic={onComposerOptimistic}
          onSent={onSent}
        />
        <Box height={insets.bottom} surface="raised"/>
      </KeyboardStickyView>
    </Col>
  );
}

/** Message-request card: a compact channel preview with Accept / Block (reusing
 *  the requests-list consent handlers) + Open. Channel-level, no conversation
 *  mount; acting advances to the next item. */
function MessageRequestCard({ request, onAdvance }: {
  request: QueuedRequest; onAdvance: () => void;
}): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const view = request.request;
  const displayTitle = view
    ? (view.peerAddress ? (getPeerName(view.peerAddress) ?? view.title) : view.title)
    : '';

  const openChannel = useCallback(() => {
    router.push({ pathname: '/xmtp/[convId]', params: { convId: request.convId } });
  }, [router, request.convId]);

  /** Accept / Block reuse the exact requests-list handlers; either resolves the
   *  request, so advance optimistically (the consent write + sync reconcile the
   *  channels list + other devices). */
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
        <Text weight="semibold" size="4xl" color={pal.link} numberOfLines={1}>
          Message request
        </Text>
        <Box margin={{ top: 12 }} style={{ alignSelf: 'stretch' }}>
          <ChannelRow
            title={displayTitle}
            avatarAddress={view?.avatarAddress ?? null}
            avatarUri={view?.avatarUri ?? null}
            square={view?.isGroup}
            lastPreview={view?.preview || '(no messages yet)'}
            onPress={openChannel}
          />
        </Box>

        <Row gap={10} margin={{ top: 16 }} style={{ alignSelf: 'stretch' }}>
          <Box flex={1}>
            <Button block variant="danger" size="md" dark={dark} onPress={() => act(false)} label="Block"
              tintBg={pal.danger} tintFg={pal.bg}/>
          </Box>
          <Box flex={1}>
            <Button block variant="primary" size="md" dark={dark} onPress={() => act(true)} label="Accept"
              tintBg={pal.link} tintFg={pal.bg}/>
          </Box>
        </Row>
        <ControlRow onSkip={onAdvance} onOpen={openChannel} dark={dark}/>
      </Box>
    </Col>
  );
}
