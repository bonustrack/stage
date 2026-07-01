<script setup lang="ts">

import { computed, ref } from 'vue';
import ViewHost from '@stage-labs/kit/vue/view-host';
import {
  basicRoot,
  emptyState, overflowMenu, OVERFLOW_MENU_PRESS,
  labelBar, LABEL_CHIP_PRESS, type LabelBarChip,
} from '@stage-labs/views';
import { metroFieldColors } from '@/lib/metroFieldColors';
import { ASK_QUESTION_MEMBERS, stampAvatarUrl } from '../lib/xmtp';
import { postCloseToParent } from '../lib/embedBridge';
import { useChannels } from '../lib/useChannels';
import { usePublishTopnav } from '../lib/topnavSlots';
import ChannelsSearchBar from '../components/ChannelsSearchBar.vue';

const {
  embedded, rows, error, query, creatingAsk,
  searchResolution, openSearchedProfile, filtered, view, cardClass, rowMenu,
  barLabels, enabledLabels, unreadOnly, toggleLabel, toggleUnread, clearAllFilters,
  onAskPress, open, openRowMenu, closeRowMenu,
  toggleRowUnread, archiveRow, openDocs, goNewGroup, goArchived, goRequests,
  goProfile, goSettings,
} = useChannels();

const UNREAD_VALUE = '__unread__';

const searchOpen = ref(false);
const { setOverride } = usePublishTopnav();
function openSearch(): void { searchOpen.value = true; setOverride(true); }
function closeSearch(): void { searchOpen.value = false; setOverride(false); query.value = ''; }

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

const overflowNode = computed(() =>
  basicRoot(
    overflowMenu({
      iconSize: 24,
      items: [
        { id: 'new', label: 'New group', icon: 'plus' },
        { id: 'archived', label: 'Archived', icon: 'archive' },
        { id: 'profile', label: 'Profile', icon: 'user' },
        { id: 'settings', label: 'Settings', icon: 'cog' },
      ],
    }),
  ),
);

const overflowActions = {
  [OVERFLOW_MENU_PRESS]: (payload: Record<string, unknown>): void => {
    const id = payload.id;
    if (id === 'new') goNewGroup();
    else if (id === 'archived') goArchived();
    else if (id === 'profile') goProfile();
    else if (id === 'settings') goSettings();
  },
};

const labelBarNode = computed(() => {
  const allSelected = !unreadOnly.value && enabledLabels.value.size === 0;
  const chips: LabelBarChip[] = [
    { value: '', label: 'All', selected: allSelected },
    { value: UNREAD_VALUE, label: 'Unread', selected: unreadOnly.value },
    ...barLabels.value.map((label) => ({
      value: label,
      label,
      selected: enabledLabels.value.has(label.toLowerCase()),
    })),
  ];
  return basicRoot(
    labelBar({
      chips,
      selectedBackground: metroFieldColors.link,
      selectedLabelColor: metroFieldColors.bg,
      restBackground: metroFieldColors.border,
      restLabelColor: metroFieldColors.fg,
    }),
  );
});

const labelBarActions = {
  [LABEL_CHIP_PRESS]: (payload: Record<string, unknown>): void => {
    const value = payload.value;
    if (typeof value !== 'string') return;
    if (value === '') { clearAllFilters(); return; }
    if (value === UNREAD_VALUE) { toggleUnread(); return; }
    toggleLabel(value);
  },
};

</script>

<template>
  <Col class="relative" :class="embedded ? 'h-[100dvh]' : 'flex-1 min-h-0 h-[calc(100dvh-52px-60px)]'">
    <!-- Embedded widget keeps its own compact header (Home/Messages title + close). -->
    <Row
      v-if="embedded"
      align="center"
      :gap="4"
      class="h-[52px] box-border shrink-0 pl-2 pr-1
        bg-metro-bg-light dark:bg-metro-bg-dark
        border-b border-metro-border-light dark:border-metro-border-dark"
    >
      <Text size="4xl" weight="semibold" class="flex-1 pl-2 text-metro-head-light dark:text-metro-head-dark">
        {{ view === 'messages' ? 'Messages' : 'Home' }}
      </Text>
      <Pressable
        tag="button"
        type="button"
        class="px-2 py-2 text-metro-fg-light dark:text-metro-fg-dark"
        title="Close"
        @click="postCloseToParent"
      >
        <Icon name="x" :size="20" />
      </Pressable>
    </Row>

    <!-- Standalone (mobile-parity): the identity topnav is hoisted app-wide in
         App.vue; this view only publishes its right slot (search/inbox/overflow)
         and a search override bar via teleports into the hoisted bar. -->
    <template v-else>
      <Teleport v-if="searchOpen" to="#topnav-override">
        <ChannelsSearchBar v-model="query" placeholder="Search channels or paste 0x… / name.eth…" @close="closeSearch" />
      </Teleport>
      <Teleport to="#topnav-right">
        <Pressable tag="button" type="button" title="Search" @click="openSearch">
          <Icon name="search" :size="24" class="text-metro-head-light dark:text-metro-head-dark" />
        </Pressable>
        <Pressable tag="button" type="button" title="Message requests" class="relative" @click="goRequests">
          <Icon name="inbox" :size="24" class="text-metro-head-light dark:text-metro-head-dark" />
        </Pressable>
        <ViewHost :node="overflowNode" :actions="overflowActions" />
      </Teleport>
    </template>

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

    <!-- MESSAGES: label filter bar + the channel list. -->
    <template v-else>
      <ViewHost v-if="!embedded" :node="labelBarNode" :actions="labelBarActions" />
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
          <ViewHost :node="emptyNode" />
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
