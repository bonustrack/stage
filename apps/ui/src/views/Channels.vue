<script setup lang="ts">

import { computed } from 'vue';
import ChatKitRenderer from '@stage-labs/kit/vue/chatkit-renderer';
import { emptyState } from '@stage-labs/views';
import { basicRoot } from '@/lib/chatkitRow';
import { ASK_QUESTION_MEMBERS, stampAvatarUrl } from '../lib/xmtp';
import { postCloseToParent } from '../lib/embedBridge';
import { useChannels } from '../lib/useChannels';
import { useEffectiveScheme } from '@/lib/kitTheme';

const scheme = useEffectiveScheme();

const emptyNode = computed(() =>
  basicRoot(
    emptyState({
      icon: 'chatBubble',
      title: query.value ? `No matches for "${query.value}"` : 'No conversations yet',
      caption: query.value
        ? undefined
        : 'Share your address from Settings to start one.',
    }),
  ),
);

const {
  embedded, rows, error, query, creatingAsk, refreshing,
  searchResolution, openSearchedProfile, filtered, view, cardClass, rowMenu,
  onAskPress, refreshFromNetwork, open, openRowMenu, closeRowMenu,
  toggleRowUnread, archiveRow, openDocs, goNewGroup, goArchived, goRequests,
  goProfile, goSettings,
} = useChannels();

</script>

<template>
  <Col class="h-[100dvh] relative" :class="embedded ? '' : 'pb-[60px]'">
    <!-- Topnav: page title, refresh, and (embedded only) a close button at the
         end, so the channels homepage has a single topnav like conversations. -->
    <Row align="center" :gap="4" class="h-[52px] box-border shrink-0 pl-2 pr-1
      bg-metro-bg-light dark:bg-metro-bg-dark
      border-b border-metro-border-light dark:border-metro-border-dark">
      <AccountSwitcher v-if="!embedded" />
      <Text size="4xl" weight="semibold" class="flex-1 pl-2 text-metro-head-light dark:text-metro-head-dark">
        {{ embedded ? (view === 'messages' ? 'Messages' : 'Home') : 'Channels' }}
      </Text>
      <template v-if="!embedded && view === 'messages'">
        <Pressable
          tag="button"
          type="button"
          class="p-2 rounded-lg text-metro-sub-light dark:text-metro-sub-dark
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
          title="Message requests"
          @click="goRequests"
        >
          <Icon name="inbox" :size="18" />
        </Pressable>
        <Pressable
          tag="button"
          type="button"
          :disabled="refreshing"
          class="p-2 rounded-lg text-metro-sub-light dark:text-metro-sub-dark
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark disabled:opacity-50"
          :title="refreshing ? 'Refreshing…' : 'Refresh channels'"
          @click="refreshFromNetwork"
        >
          <Icon name="arrowDown" :size="16" :class="refreshing ? 'animate-spin' : ''" />
        </Pressable>
        <OverflowMenu :size="18">
          <template #default="{ run }">
            <OverflowItem icon="plus" label="New group" @select="run(goNewGroup)" />
            <OverflowItem icon="archive" label="Archived" @select="run(goArchived)" />
            <OverflowItem icon="user" label="Profile" @select="run(goProfile)" />
            <OverflowItem icon="cog" label="Settings" @select="run(goSettings)" />
          </template>
        </OverflowMenu>
      </template>
      <Pressable
        tag="button"
        v-if="embedded"
        type="button"
        class="px-2 py-2 text-metro-fg-light dark:text-metro-fg-dark"
        title="Close"
        @click="postCloseToParent"
      >
        <Icon name="x" :size="20" />
      </Pressable>
    </Row>

    <!-- HOME: the "Ask a question" action card. Messages/Docs live in the footer nav. -->
    <Col v-if="view === 'home'" align="center" justify="center" :gap="12" class="flex-1 px-6">
      <Pressable tag="button" type="button" :disabled="creatingAsk" :class="cardClass" @click="onAskPress">
        <Icon name="chatBubble" :size="24" class="shrink-0 text-metro-fg-light dark:text-metro-fg-dark" />
        <Text size="xl" color="link" class="flex-1">{{ creatingAsk ? 'Creating group…' : 'Ask a question' }}</Text>
        <Row align="center" class="shrink-0">
          <img
            v-for="(addr, i) in ASK_QUESTION_MEMBERS"
            :key="addr"
            :src="stampAvatarUrl(addr, 56)"
            alt=""
            class="w-7 h-7 rounded-full bg-metro-border-light dark:bg-metro-border-dark
              border-2 border-metro-bg-light dark:border-metro-bg-dark"
            :class="i === 0 ? '' : '-ml-2'"
          />
        </Row>
      </Pressable>
      <Col v-if="error" class="text-xs text-metro-err mt-1">{{ error }}</Col>
    </Col>

    <!-- MESSAGES: search (standalone) + the channel list. -->
    <template v-else>
      <Col v-if="!embedded" class="shrink-0 px-4 pt-3 pb-2 bg-metro-bg-light dark:bg-metro-bg-dark">
        <Input
          v-model="query"
          inputType="text"
          :dark="scheme === 'dark'"
          placeholder="Search channels or paste 0x… / name.eth…"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          class="w-full bg-metro-surface-light dark:bg-metro-surface-dark
            border border-metro-border-light dark:border-metro-border-dark rounded-lg px-3 py-2 text-sm
            text-metro-fg-light dark:text-metro-fg-dark outline-none
            placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark"
        />
      </Col>
      <SearchResolution
        :status="searchResolution.status"
        :address="searchResolution.address"
        :query="query"
        @open="openSearchedProfile"
      />
      <ProposalsBanner v-if="!embedded" />
      <BackupNudge v-if="!embedded" />
      <Col v-if="error" align="center" justify="center" class="flex-1 text-sm text-metro-fg-light dark:text-metro-fg-dark px-6">
        {{ error }}
      </Col>
      <Col v-else-if="!rows" align="center" justify="center" class="flex-1 text-metro-head-light dark:text-metro-head-dark">
        <Spinner :size="28" />
      </Col>
      <ul v-else class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-6">
        <li v-if="filtered && filtered.length === 0">
          <ChatKitRenderer :node="emptyNode" />
        </li>
        <li v-for="r in filtered ?? rows" :key="r.convId">
          <ChannelRow
            :avatar-address="r.avatarAddress"
            :avatar-uri="r.avatarUri"
            :title="r.title"
            :last-ts="r.lastTs"
            :last-preview="r.lastPreview"
            :unread-count="r.unreadCount"
            :marked-unread="r.markedUnread"
            @open="open(r.convId)"
            @menu="(ev) => openRowMenu(r, ev)"
          />
        </li>
      </ul>
    </template>

    <!-- Footer nav (Intercom-style): Home / Messages / Docs — embedded widget only.
         The standalone site uses the app-wide TabBar instead (mobile-app UX). -->
    <Row v-if="embedded" align="stretch" class="shrink-0 border-t border-metro-border-light dark:border-metro-border-dark
      bg-metro-bg-light dark:bg-metro-bg-dark">
      <Col tag="button" type="button" align="center" :gap="4" class="flex-1 py-2.5 transition-colors"
        :class="view === 'home' ? 'text-metro-head-light dark:text-metro-head-dark' : 'text-metro-sub-light dark:text-metro-sub-dark'"
        @click="view = 'home'">
        <Icon name="home" :size="22" />
        <span class="text-[15px] font-sans">Home</span>
      </Col>
      <Col tag="button" type="button" align="center" :gap="4" class="flex-1 py-2.5 transition-colors"
        :class="view === 'messages' ? 'text-metro-head-light dark:text-metro-head-dark' : 'text-metro-sub-light dark:text-metro-sub-dark'"
        @click="view = 'messages'">
        <Icon name="list" :size="22" />
        <span class="text-[15px] font-sans">Messages</span>
      </Col>
      <Col tag="button" type="button" align="center" :gap="4"
        class="flex-1 py-2.5 text-metro-sub-light dark:text-metro-sub-dark
          hover:text-metro-head-light dark:hover:text-metro-head-dark transition-colors"
        @click="openDocs">
        <Icon name="document" :size="22" />
        <span class="text-[15px] font-sans">Docs</span>
      </Col>
    </Row>

    <!-- Per-row context menu: Mark as read / unread (cross-device via XMTP consent). -->
    <template v-if="rowMenu">
      <Col class="fixed inset-0 z-40" @click="closeRowMenu" @contextmenu.prevent="closeRowMenu" />
      <Col
        class="fixed z-50 min-w-[180px] py-1 rounded-lg shadow-lg
          bg-metro-bg-light dark:bg-metro-surface-dark
          border border-metro-border-light dark:border-metro-border-dark"
        :style="{ left: rowMenu.x + 'px', top: rowMenu.y + 'px' }"
      >
        <Pressable
          tag="button"
          type="button"
          class="w-full text-left px-3 py-2 text-sm
            text-metro-head-light dark:text-metro-head-dark
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
          @click="toggleRowUnread"
        >
          {{ rowMenu.isUnread ? 'Mark as read' : 'Mark as unread' }}
        </Pressable>
        <Pressable
          tag="button"
          type="button"
          class="w-full text-left px-3 py-2 text-sm
            text-metro-head-light dark:text-metro-head-dark
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
          @click="archiveRow"
        >
          Archive
        </Pressable>
      </Col>
    </template>
  </Col>
</template>
