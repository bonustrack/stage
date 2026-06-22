<script setup lang="ts">

import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import {
  getXmtpAccountInfo, shortAddress, type XmtpInstallationView,
} from '../../lib/xmtp';

const router = useRouter();
const palette = useKitPalette();

const address = ref('');
const inboxId = ref('');
const installationId = ref('');
const env = ref('');
const installations = ref<XmtpInstallationView[] | null>(null);
const failed = ref(false);
const copiedKey = ref('');

onMounted(async () => {
  try {
    const info = await getXmtpAccountInfo();
    address.value = info.address;
    inboxId.value = info.inboxId;
    installationId.value = info.installationId;
    env.value = info.env;
    installations.value = info.installations;
  } catch {
    failed.value = true;
  }
});

async function copy(key: string, value: string): Promise<void> {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    copiedKey.value = key;
    setTimeout(() => { if (copiedKey.value === key) copiedKey.value = ''; }, 1500);
  } catch { }
}

function whenLabel(ms: number | null): string {
  if (ms == null) return 'unknown date';
  return new Date(ms).toLocaleDateString();
}
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <!-- Toolbar header matches the XMTP screens: back arrow + small title. -->
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
      <Title size="sm">Messenger</Title>
    </Row>

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8">
      <!-- XMTP ACCOUNT: copy-able identity rows grouped into ONE card with internal
           1px dividers, mirroring mobile MessengerSettings' single ListView of rows
           (not one floating card per row). -->
      <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark px-4 pt-5 pb-1">XMTP ACCOUNT</Text>

      <Col
        class="w-[calc(100%-2rem)] mx-4 mt-2 rounded-xl overflow-hidden border
          bg-metro-surface-light dark:bg-metro-surface-dark"
        :style="{ borderColor: palette.border }"
      >
        <Pressable
          v-if="address"
          tag="button"
          type="button"
          class="block w-full p-3 text-left
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors"
          @click="copy('addr', address)"
        >
          <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark">
            ADDRESS ({{ copiedKey === 'addr' ? 'copied!' : 'tap to copy' }})
          </Text>
          <Text size="xs" tag="div" class="text-metro-fg-light dark:text-metro-fg-dark mt-0.5">{{ shortAddress(address) }}</Text>
        </Pressable>

        <Pressable
          v-if="inboxId"
          tag="button"
          type="button"
          class="block w-full p-3 text-left border-t
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors"
          :style="{ borderColor: palette.border }"
          @click="copy('inbox', inboxId)"
        >
          <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark">
            INBOX ID ({{ copiedKey === 'inbox' ? 'copied!' : 'tap to copy' }})
          </Text>
          <Text size="xs" tag="div" class="text-metro-fg-light dark:text-metro-fg-dark mt-0.5 break-all">{{ inboxId }}</Text>
        </Pressable>

        <Pressable
          v-if="installationId"
          tag="button"
          type="button"
          class="block w-full p-3 text-left border-t
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors"
          :style="{ borderColor: palette.border }"
          @click="copy('install', installationId)"
        >
          <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark">
            INSTALLATION ID ({{ copiedKey === 'install' ? 'copied!' : 'tap to copy' }})
          </Text>
          <Text size="xs" tag="div" class="text-metro-fg-light dark:text-metro-fg-dark mt-0.5">{{ shortAddress(installationId) }}</Text>
        </Pressable>

        <Col
          v-if="env"
          class="p-3 border-t"
          :style="{ borderColor: palette.border }"
        >
          <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark">ENVIRONMENT</Text>
          <Text size="xs" tag="div" class="text-metro-fg-light dark:text-metro-fg-dark mt-0.5">{{ env }}</Text>
        </Col>
      </Col>

      <!-- ACTIVE SESSIONS: installation list, mirroring mobile MessengerSessions.
           Revoke is read-only on web: browser-sdk only exposes
           revokeInstallationsSignatureRequest (needs an interactive signer flow),
           so sessions are shown without a revoke action for now. -->
      <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark px-4 pt-6 pb-1">ACTIVE SESSIONS</Text>

      <Row v-if="installations === null && !failed" align="center" :gap="8" class="px-4 pt-2">
        <Spinner :size="18" />
        <Text size="sm" role="secondary">Loading sessions…</Text>
      </Row>
      <Col v-else-if="failed" class="px-4 pt-2">
        <Text size="sm" role="secondary">Messaging isn't ready yet — open a chat first, then come back.</Text>
      </Col>
      <Col v-else-if="installations && installations.length === 0" class="px-4 pt-2">
        <Text size="sm" role="secondary">No active sessions.</Text>
      </Col>
      <Col
        v-else
        class="w-[calc(100%-2rem)] mx-4 mt-2 rounded-xl overflow-hidden border
          bg-metro-surface-light dark:bg-metro-surface-dark"
        :style="{ borderColor: palette.border }"
      >
        <Row
          v-for="(inst, i) in installations ?? []"
          :key="inst.id"
          align="center"
          :gap="12"
          class="p-3"
          :class="i === 0 ? '' : 'border-t'"
          :style="i === 0 ? {} : { borderColor: palette.border }"
        >
          <Icon name="deviceTablet" :size="22" :color="palette.text" />
          <Col class="flex-1 min-w-0">
            <Row align="center" :gap="8">
              <Text size="sm" class="text-metro-fg-light dark:text-metro-fg-dark">{{ shortAddress(inst.id) }}</Text>
              <Text
                v-if="inst.current"
                size="3xs"
                class="uppercase"
                :style="{ color: palette.success }"
              >This device</Text>
            </Row>
            <Text size="2xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark">Added {{ whenLabel(inst.createdAtMs) }}</Text>
          </Col>
        </Row>
      </Col>
    </Col>
  </Col>
</template>
