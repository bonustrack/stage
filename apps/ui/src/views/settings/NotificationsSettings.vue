<script setup lang="ts">

import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ViewHost from '@stage-labs/kit/vue/view-host';
import type { ListViewNode } from '@stage-labs/kit/kit';
import {
  settingsHeader, settingsButtonRow, settingsValueRow, SCREEN_BACK, SETTINGS_BUTTON_PRESS,
} from '@stage-labs/views';

const router = useRouter();
const palette = useKitPalette();

const headerNode = computed(() => settingsHeader({
  title: 'Notifications',
  backColor: palette.text,
  surface: palette.toolbarBg,
  borderColor: palette.border,
  safeTop: 0,
}));

const supported = typeof window !== 'undefined' && 'Notification' in window;
const permission = ref<NotificationPermission>(supported ? Notification.permission : 'denied');
const busy = ref(false);

onMounted(() => {
  if (supported) permission.value = Notification.permission;
});

async function requestPermission(): Promise<void> {
  if (!supported || busy.value) return;
  busy.value = true;
  try {
    permission.value = await Notification.requestPermission();
  } catch { } finally {
    busy.value = false;
  }
}

const statusLabel = computed<string>(() => {
  if (!supported) return "This browser doesn't support notifications.";
  if (permission.value === 'granted') return 'Browser notifications are allowed.';
  if (permission.value === 'denied') return 'Blocked in browser settings — enable notifications for this site to receive them.';
  return 'Allow browser notifications to be alerted about new messages while Stage is open.';
});

const DESC = 'Get notified about new messages while Stage is open in this browser.';

const node = computed<ListViewNode>(() => ({
  type: 'ListView',
  children: [permission.value === 'granted'
    ? settingsValueRow({ label: 'Browser notifications', value: 'Allowed' })
    : settingsButtonRow({
      label: 'Enable',
      description: DESC,
      clickType: SETTINGS_BUTTON_PRESS,
    })],
}));

const actions = {
  [SCREEN_BACK]: (): void => { router.back(); },
  [SETTINGS_BUTTON_PRESS]: (): void => { void requestPermission(); },
};
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <ViewHost :node="headerNode" :actions="actions" />

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8">
      <!-- PUSH NOTIFICATIONS: mirrors mobile NotificationsSettings' single toggle card.
           The web Notification API has no background push, so this drives the
           per-site permission instead of a daemon registration; the permission state
           is the web-appropriate equivalent of mobile's OS permission line. -->
      <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark px-4 pt-5 pb-2">NOTIFICATIONS</Text>
      <Col class="w-[calc(100%-2rem)] mx-4">
        <ViewHost :node="node" :actions="actions" />
      </Col>
      <Text size="2xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark px-4 pt-3">
        {{ statusLabel }}
      </Text>
    </Col>
  </Col>
</template>
