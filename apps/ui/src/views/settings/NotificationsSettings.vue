<script setup lang="ts">

import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';

const router = useRouter();
const palette = useKitPalette();

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
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <Row
      surface="toolbar"
      align="center"
      :gap="8"
      :padding="{ x: 12, y: 10 }"
      :style="{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: palette.border }"
    >
      <Pressable tag="button" type="button" class="p-1" @click="router.back()">
        <Icon name="arrowLeft" :size="22" :color="palette.text" />
      </Pressable>
      <Title size="sm">Notifications</Title>
    </Row>

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8">
      <!-- PUSH NOTIFICATIONS: mirrors mobile NotificationsSettings' single toggle card.
           The web Notification API has no background push, so this drives the
           per-site permission instead of a daemon registration; the permission state
           is the web-appropriate equivalent of mobile's OS permission line. -->
      <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark px-4 pt-5 pb-2">NOTIFICATIONS</Col>
      <Col
        class="w-[calc(100%-2rem)] mx-4 rounded-xl border bg-metro-surface-light dark:bg-metro-surface-dark p-3.5"
        :style="{ borderColor: palette.border }"
      >
        <Row align="center" :gap="12">
          <Col class="flex-1 min-w-0">
            <span class="text-[14px] font-semibold text-metro-head-light dark:text-metro-head-dark">Browser notifications</span>
            <Col class="text-[12px] text-metro-sub-light dark:text-metro-sub-dark mt-0.5">
              Get notified about new messages while Stage is open in this browser.
            </Col>
          </Col>
          <span
            v-if="permission === 'granted'"
            class="text-[11px] uppercase shrink-0"
            :style="{ color: palette.success }"
          >Allowed</span>
          <Pressable
            v-else
            tag="button"
            type="button"
            class="shrink-0 px-3 py-1.5 rounded-full border text-[13px] transition-colors disabled:opacity-50
              hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
            :style="{ borderColor: palette.border, color: palette.text }"
            :disabled="!supported || permission === 'denied' || busy"
            @click="requestPermission()"
          >Enable</Pressable>
        </Row>
      </Col>
      <Col class="text-[12px] text-metro-sub-light dark:text-metro-sub-dark px-4 pt-3">
        {{ statusLabel }}
      </Col>
    </Col>
  </Col>
</template>
