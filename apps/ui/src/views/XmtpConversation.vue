<script setup lang="ts">

import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import { emptyState } from '@stage-labs/views';
import { basicRoot } from '@/lib/kitRow';
import { useXmtpConversation } from '../lib/useXmtpConversation';

const emptyNode = basicRoot(emptyState({ title: 'Type a message below to start chatting.' }));

const {
  router, line, feed, myUri, replyingTo, actionTarget,
  peerAddress, groupName, isGroup, inboxToAddr, memberAddresses, mentionCandidates,
  reactions, ownEmojis, pollVotes, ownPollVotes, onVote,
  allBubbles, highlightId, scrollStickToBottom, scrollToNonce, scrollToId, openHeader, previewOf,
  onReact, onOptimistic, onSent, onActionReply, onBubbleReply,
  onActionCopy, onActionCopyLink,
} = useXmtpConversation();
</script>

<template>
  <Col class="fixed inset-0 flex flex-col bg-metro-bg-light dark:bg-metro-bg-dark">
    <ConversationHeader
      :peer-address="peerAddress"
      :group-name="groupName"
      :is-group="isGroup"
      :member-addresses="memberAddresses"
      :status="feed.status.value"
      @back="router.push('/channels')"
      @open="openHeader"
    />

    <!-- Gradient fades (no hard border) under the topnav + above the composer, like mobile. -->
    <Col class="relative flex-1 min-h-0">
      <Col class="pointer-events-none absolute top-0 inset-x-0 h-6 z-10 bg-gradient-to-b from-metro-bg-light dark:from-metro-bg-dark to-transparent" />
      <Col class="pointer-events-none absolute bottom-0 inset-x-0 h-6 z-10 bg-gradient-to-t from-metro-bg-light dark:from-metro-bg-dark to-transparent" />
      <Scroll
        class="py-3"
        fill-absolute
        hide-scrollbar
        :stick-to-bottom="scrollStickToBottom"
        :scroll-to-nonce="scrollToNonce"
        :scroll-to-id="scrollToId">
      <Row v-if="allBubbles.length === 0 && feed.status.value === 'loading'"
        class="h-full flex items-center justify-center text-metro-head-light dark:text-metro-head-dark">
        <Spinner :size="28" />
      </Row>
      <Col v-else-if="allBubbles.length === 0 && feed.status.value === 'open'">
        <KitRenderer :node="emptyNode" />
      </Col>
      <MessengerBubble
        v-for="entry in allBubbles"
        :key="entry.id"
        :id="`msg-${entry.id}`"
        :class="{ 'metro-msg-flash': entry.id === highlightId }"
        :entry="entry"
        :mine="entry.from === myUri"
        :inbox-to-addr="inboxToAddr"
        :reactions="reactions.get(entry.id)"
        :own-emojis="ownEmojis.get(entry.id)"
        :poll-votes="pollVotes.get(entry.id)"
        :own-poll-votes="ownPollVotes.get(entry.id)"
        :reply-target="entry.id === highlightId"
        :reply-preview="entry.replyTo
          ? previewOf(feed.events.value.find(e => e.id === entry.replyTo) ?? entry)
          : undefined"
        @request-actions="actionTarget = $event"
        @react="onReact($event.entry.id, $event.emoji)"
        @reply="onBubbleReply($event)"
        @open-avatar="router.push(`/user/${$event}`)"
        @vote="onVote($event.entry.id, $event.questionIndex, $event.optionIndex, $event.action)"
      />
      </Scroll>
    </Col>

    <Composer
      v-if="line"
      :line="line"
      :mention-candidates="mentionCandidates"
      :replying-to="replyingTo"
      @clear-reply="replyingTo = null"
      @optimistic="onOptimistic"
      @sent="onSent"
    />

    <BubbleActionSheet
      :target="actionTarget"
      @close="actionTarget = null"
      @react="onReact(actionTarget!.id, $event)"
      @reply="onActionReply"
      @copy="onActionCopy"
      @copy-link="onActionCopyLink"
    />
  </Col>
</template>

<style scoped>
/* Brief highlight when arriving at a message via a ?m=<id> permalink. */
.metro-msg-flash {
  animation: metro-msg-flash 2.2s ease-out;
}
@keyframes metro-msg-flash {
  0%, 30% { background-color: rgba(99, 102, 241, 0.18); }
  100% { background-color: transparent; }
}
</style>
