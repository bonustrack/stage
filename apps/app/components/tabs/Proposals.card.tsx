/** The single active proposal card on the Proposals tab.
 *
 *  Mounts the FULL conversation machinery for ONE channel via
 *  `useConversationState`, so the poll's vote tally + casting reuse the exact
 *  same path as the chat view (optimistic `useVotesLayer` -> `xmtpVote`
 *  reactions). The card surfaces just the poll: title + `PollView` options
 *  (tap = cast vote), with Skip / Open-channel controls and the standard
 *  `MessengerComposer` underneath so Less can send a custom message instead.
 *  Voting or sending advances to the next proposal.
 *
 *  Keyed by convId at the call site so switching proposals remounts the hook
 *  cleanly (fresh feed for the next channel). */

import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Button } from '@metro-labs/kit/button';
import { Text } from '@metro-labs/kit/text';
import { Box, Row, Col } from '../layout';
import { Avatar } from '../Avatar';
import { MessengerComposer } from '../MessengerComposer';
import { useConversationState } from '../xmtp-conv/useConversationState';
import { pollOf, fmtTs } from '../MessengerBubble.helpers';
import { PollView } from '../MessengerBubble.poll';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { getPeerName } from '../../lib/peerProfiles';
import { shortAddress } from '../../modules/messaging';
import type { QueuedProposal } from './Proposals.queue';

export function ProposalCard({ proposal, onAdvance }: {
  proposal: QueuedProposal;
  /** Advance to the next proposal (Skip, or after a vote / custom send). */
  onAdvance: () => void;
}): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const fg = pal.text, sub = pal.text;

  const c = useConversationState(proposal.convId, undefined);
  const {
    activeLine, events, myUri, isGroup, groupName, peerAddr,
    mentionCandidates, displayVotes, displayOwnVotes, onVote,
    displayOpenAnswers, onOpenAnswer, onOptimistic, onSent,
    senderEthOf,
  } = c;

  /** The poll message itself — re-find it in the live feed by the queued id so
   *  the tally stays live as votes stream in. */
  const entry = useMemo(() => events.find(e => e.id === proposal.pollMsgId), [events, proposal.pollMsgId]);
  const poll = entry ? pollOf(entry) : undefined;

  const title = isGroup
    ? (groupName?.trim() || 'Untitled group')
    : (peerAddr ? (getPeerName(peerAddr) ?? shortAddress(peerAddr)) : '');

  /** Poll author: resolve eth address from the message sender the same way chat
   *  bubbles do (`senderEthOf`), then its display name + stamp avatar. */
  const authorAddr = useMemo(
    () => (entry ? senderEthOf(entry.from) : null),
    [entry, senderEthOf],
  );
  /** Name resolves from the peerProfiles cache; the card re-renders when the
   *  hook's profile version bumps, so this picks up the resolved name/avatar. */
  const authorName = authorAddr ? (getPeerName(authorAddr) ?? shortAddress(authorAddr)) : null;
  const postedAt = entry?.ts ? fmtTs(entry.ts) : null;

  const openChannel = useCallback(() => {
    router.push({ pathname: '/xmtp/[convId]', params: { convId: proposal.convId } });
  }, [router, proposal.convId]);

  /** A custom message send counts as acting on this proposal → advance after the
   *  optimistic add fires (the send itself rides the composer's own pipeline). */
  const onComposerOptimistic = useCallback((entryArg: Parameters<NonNullable<typeof onOptimistic>>[0]) => {
    onOptimistic?.(entryArg);
    onAdvance();
  }, [onOptimistic, onAdvance]);

  return (
    <Col flex={1} surface="surface">
      <Box flex={1} padding={{ x: 16, top: 16 }} style={{ alignSelf: 'stretch' }}>
        {/* Channel name → the proposal's source. Same style as the conversation
         *  topnav title (semibold / 4xl / link color), not an eyebrow. */}
        <Text weight="semibold" size="4xl" color={pal.link} numberOfLines={1}>
          {title}
        </Text>
        {/* Who posted the poll + when, mirroring chat sender resolution. */}
        {authorName ? (
          <Row gap={6} align="center" margin={{ top: 8 }}>
            <Avatar address={authorAddr} size="sm"/>
            <Text weight="medium" size="sm" color={fg} numberOfLines={1}>{authorName}</Text>
            {postedAt ? <Text size="xs" role="secondary">· {postedAt}</Text> : null}
          </Row>
        ) : null}
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
            votes={displayVotes.get(proposal.pollMsgId)}
            ownVotes={displayOwnVotes.get(proposal.pollMsgId)}
            onVote={(q, o, action) => { onVote(proposal.pollMsgId, q, o, action); }}
            openAnswers={displayOpenAnswers.get(proposal.pollMsgId)}
            onOpenAnswer={(q, text) => { onOpenAnswer(proposal.pollMsgId, q, text); }}
            myUri={myUri}
          />
        ) : (
          <Text role="secondary" style={{ marginTop: 12 }}>Loading proposal…</Text>
        )}
        {/* Controls: Skip advances without voting; Open jumps into the channel. */}
        <Row gap={10} margin={{ top: 16 }} style={{ alignSelf: 'stretch' }}>
          <Box flex={1}>
            <Button variant="secondary" size="md" dark={dark} onPress={onAdvance} label="Skip"/>
          </Box>
          <Box flex={1}>
            <Button variant="ghost" size="md" dark={dark} onPress={openChannel} label="Open channel"/>
          </Box>
        </Row>
        <Text size="xs" role="secondary" style={{ marginTop: 10, opacity: 0.7 }}>
          Tap an option to vote, or send a custom message below.
        </Text>
      </Box>
      {/* Composer wired to this proposal's channel — a custom send advances too. */}
      <MessengerComposer
        dark={dark}
        xmtpLine={activeLine}
        mentionCandidates={mentionCandidates}
        onOptimistic={onComposerOptimistic}
        onSent={onSent}
      />
    </Col>
  );
}
