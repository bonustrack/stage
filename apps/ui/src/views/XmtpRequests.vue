<script setup lang="ts">

import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import { emptyState } from '@stage-labs/views';
import { basicRoot } from '@/lib/kitRow';
import { useEffectiveScheme } from '@/lib/kitTheme';
import {
  listRequestConvs, acceptRequestConv, blockRequestConv,
} from '../lib/xmtpRequests';
import type { ConversationRequestView } from '@stage-labs/client/xmtp/request';

const router = useRouter();
const scheme = useEffectiveScheme();
const palette = useKitPalette();

const dark = computed(() => scheme.value === 'dark');
const acceptBg = computed(() => (dark.value ? '#15321f' : '#dcf5e6'));
const acceptFg = computed(() => (dark.value ? '#34d399' : '#15803d'));

const rows = ref<ConversationRequestView[] | null>(null);

async function load(): Promise<void> {
  try { rows.value = await listRequestConvs(); }
  catch { rows.value = []; }
}

onMounted(() => { void load(); });

function open(convId: string): void { void router.push(`/xmtp/${convId}`); }

const emptyNode = basicRoot(emptyState({ title: 'No message requests.' }));

async function act(convId: string, accept: boolean): Promise<void> {
  const prev = rows.value;
  rows.value = (rows.value ?? []).filter(r => r.convId !== convId);
  try {
    if (accept) await acceptRequestConv(convId);
    else await blockRequestConv(convId);
  } catch {
    rows.value = prev;
  }
}
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
      <Title size="sm">Message requests</Title>
    </Row>

    <Col v-if="rows === null" align="center" justify="center" class="flex-1">
      <Spinner :size="28" />
    </Col>
    <Col v-else-if="rows.length === 0" align="center" justify="center" class="flex-1">
      <KitRenderer :node="emptyNode" />
    </Col>
    <ul v-else class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-6">
      <li v-for="r in rows" :key="r.convId">
        <Row align="center" :padding="{ right: 12 }">
          <Col class="flex-1 min-w-0">
            <ChannelRow
              :avatar-address="r.avatarAddress"
              :avatar-uri="r.avatarUri"
              :title="r.title"
              :last-ts="null"
              :last-preview="r.preview || '(no messages yet)'"
              :unread-count="0"
              @open="open(r.convId)"
            />
          </Col>
          <Row :gap="8" class="shrink-0">
            <Pressable
              tag="button"
              type="button"
              title="Block"
              class="flex items-center justify-center"
              :style="{ width: '36px', height: '36px', borderRadius: '18px', borderWidth: '1px', borderStyle: 'solid', borderColor: palette.border }"
              @click="act(r.convId, false)"
            >
              <Icon name="x" :size="18" :color="palette.danger" />
            </Pressable>
            <Pressable
              tag="button"
              type="button"
              title="Accept"
              class="flex items-center justify-center"
              :style="{ width: '36px', height: '36px', borderRadius: '18px', backgroundColor: acceptBg }"
              @click="act(r.convId, true)"
            >
              <Icon name="check" :size="18" :color="acceptFg" />
            </Pressable>
          </Row>
        </Row>
      </li>
    </ul>
  </Col>
</template>
