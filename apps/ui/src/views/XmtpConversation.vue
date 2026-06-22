<script setup lang="ts">

import { ref } from 'vue';
import { useXmtpConversation } from '../lib/useXmtpConversation';

const scroller = ref<HTMLElement | null>(null);

const {
  router, line, feed, myUri, replyingTo, actionTarget,
  peerAddress, groupName, isGroup, inboxToAddr, memberAddresses, mentionCandidates,
  reactions, ownEmojis, pollVotes, ownPollVotes, onVote,
  allBubbles, highlightId, openHeader, previewOf,
  onReact, onOptimistic, onSent, onActionReply, onBubbleReply,
  onActionCopy, onActionCopyLink,
} = useXmtpConversation(scroller);
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
      <!-- kit-exception: ref-measured scroll viewport; composable reads scrollTop/scrollHeight and needs absolute inset-0 + no-scrollbar, which kit Scroll cannot express -->
      <component :is="'div'" ref="scroller" class="absolute inset-0 overflow-y-auto py-3 no-scrollbar">
      <Row v-if="allBubbles.length === 0 && feed.status.value === 'loading'"
        class="h-full flex items-center justify-center text-metro-head-light dark:text-metro-head-dark">
        <Spinner :size="28" />
      </Row>
      <Col v-else-if="allBubbles.length === 0 && feed.status.value === 'open'"
        class="p-8 text-center text-sm text-metro-sub-light dark:text-metro-sub-dark">
        Type a message below to start chatting.
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
      </component>
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
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { scrollbar-width: none; }

/* Brief highlight when arriving at a message via a ?m=<id> permalink. */
.metro-msg-flash {
  animation: metro-msg-flash 2.2s ease-out;
}
@keyframes metro-msg-flash {
  0%, 30% { background-color: rgba(99, 102, 241, 0.18); }
  100% { background-color: transparent; }
}
</style>
