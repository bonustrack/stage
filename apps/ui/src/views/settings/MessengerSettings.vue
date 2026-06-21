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
      <!-- XMTP ACCOUNT: copy-able identity rows, mirroring mobile MessengerSettings CopyRows. -->
      <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark px-4 pt-5 pb-1">XMTP ACCOUNT</Col>

      <Pressable
        v-if="address"
        tag="button"
        type="button"
        class="block w-[calc(100%-2rem)] mx-4 mt-2 p-3 rounded-xl text-left border
          bg-metro-surface-light dark:bg-metro-surface-dark"
        :style="{ borderColor: palette.border }"
        @click="copy('addr', address)"
      >
        <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
          ADDRESS ({{ copiedKey === 'addr' ? 'copied!' : 'tap to copy' }})
        </Col>
        <Col class="text-[13px] text-metro-fg-light dark:text-metro-fg-dark mt-0.5">{{ shortAddress(address) }}</Col>
      </Pressable>

      <Pressable
        v-if="inboxId"
        tag="button"
        type="button"
        class="block w-[calc(100%-2rem)] mx-4 mt-2 p-3 rounded-xl text-left border
          bg-metro-surface-light dark:bg-metro-surface-dark"
        :style="{ borderColor: palette.border }"
        @click="copy('inbox', inboxId)"
      >
        <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
          INBOX ID ({{ copiedKey === 'inbox' ? 'copied!' : 'tap to copy' }})
        </Col>
        <Col class="text-[13px] text-metro-fg-light dark:text-metro-fg-dark mt-0.5 break-all">{{ inboxId }}</Col>
      </Pressable>

      <Pressable
        v-if="installationId"
        tag="button"
        type="button"
        class="block w-[calc(100%-2rem)] mx-4 mt-2 p-3 rounded-xl text-left border
          bg-metro-surface-light dark:bg-metro-surface-dark"
        :style="{ borderColor: palette.border }"
        @click="copy('install', installationId)"
      >
        <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
          INSTALLATION ID ({{ copiedKey === 'install' ? 'copied!' : 'tap to copy' }})
        </Col>
        <Col class="text-[13px] text-metro-fg-light dark:text-metro-fg-dark mt-0.5">{{ shortAddress(installationId) }}</Col>
      </Pressable>

      <Col
        v-if="env"
        class="w-[calc(100%-2rem)] mx-4 mt-2 p-3 rounded-xl border
          bg-metro-surface-light dark:bg-metro-surface-dark"
        :style="{ borderColor: palette.border }"
      >
        <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">ENVIRONMENT</Col>
        <Col class="text-[13px] text-metro-fg-light dark:text-metro-fg-dark mt-0.5">{{ env }}</Col>
      </Col>

      <!-- ACTIVE SESSIONS: installation list, mirroring mobile MessengerSessions.
           Revoke is read-only on web: browser-sdk only exposes
           revokeInstallationsSignatureRequest (needs an interactive signer flow),
           so sessions are shown without a revoke action for now. -->
      <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark px-4 pt-6 pb-1">ACTIVE SESSIONS</Col>

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
      <template v-else>
        <Row
          v-for="inst in installations ?? []"
          :key="inst.id"
          align="center"
          :gap="12"
          class="w-[calc(100%-2rem)] mx-4 mt-2 p-3 rounded-xl border
            bg-metro-surface-light dark:bg-metro-surface-dark"
          :style="{ borderColor: palette.border }"
        >
          <Icon name="deviceTablet" :size="22" :color="palette.text" />
          <Col class="flex-1 min-w-0">
            <Row align="center" :gap="8">
              <span class="text-[14px] text-metro-fg-light dark:text-metro-fg-dark">{{ shortAddress(inst.id) }}</span>
              <span
                v-if="inst.current"
                class="text-[10px] uppercase"
                :style="{ color: palette.success }"
              >This device</span>
            </Row>
            <span class="text-[12px] text-metro-sub-light dark:text-metro-sub-dark">Added {{ whenLabel(inst.createdAtMs) }}</span>
          </Col>
        </Row>
      </template>
    </Col>
  </Col>
</template>
