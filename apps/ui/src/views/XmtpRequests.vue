<script setup lang="ts">

import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  listRequestConvs, acceptRequestConv, blockRequestConv,
} from '../lib/xmtpRequests';
import type { ConversationRequestView } from '@stage-labs/client/xmtp/request';

const router = useRouter();

const rows = ref<ConversationRequestView[] | null>(null);

async function load(): Promise<void> {
  try { rows.value = await listRequestConvs(); }
  catch { rows.value = []; }
}

onMounted(() => { void load(); });

function open(convId: string): void { void router.push(`/xmtp/${convId}`); }

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
  <Col class="h-[100dvh] bg-metro-bg-light dark:bg-metro-bg-dark">
    <Row align="center" class="h-[56px] box-border shrink-0 px-2
      border-b border-metro-border-light dark:border-metro-border-dark">
      <Pressable tag="button" type="button" class="p-1.5" @click="router.back()">
        <Icon name="arrowLeft" :size="22" />
      </Pressable>
      <Col class="flex-1 font-head text-[17px] text-metro-head-light dark:text-metro-head-dark pl-1">
        Message requests
      </Col>
    </Row>

    <Col v-if="rows === null" align="center" justify="center"
      class="flex-1 text-metro-head-light dark:text-metro-head-dark">
      <Spinner :size="28" />
    </Col>
    <Col v-else-if="rows.length === 0" align="center" justify="center"
      class="flex-1 text-sm text-metro-sub-light dark:text-metro-sub-dark px-6">
      No message requests.
    </Col>
    <ul v-else class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-6">
      <li v-for="r in rows" :key="r.convId">
        <Row align="center" class="pr-3">
          <Col class="flex-1 min-w-0">
            <ChannelRow
              :avatar-address="r.avatarAddress"
              :avatar-uri="r.avatarUri"
              :title="r.title"
              :last-ts="null"
              :last-preview="r.preview"
              :unread-count="0"
              @open="open(r.convId)"
            />
          </Col>
          <Row :gap="8" class="shrink-0">
            <Pressable
              tag="button"
              type="button"
              title="Block"
              class="w-9 h-9 rounded-full flex items-center justify-center
                border border-metro-border-light dark:border-metro-border-dark
                text-metro-err"
              @click="act(r.convId, false)"
            >
              <Icon name="x" :size="18" />
            </Pressable>
            <Pressable
              tag="button"
              type="button"
              title="Accept"
              class="w-9 h-9 rounded-full flex items-center justify-center
                bg-metro-head-light dark:bg-metro-head-dark
                text-metro-bg-light dark:text-metro-bg-dark"
              @click="act(r.convId, true)"
            >
              <Icon name="check" :size="18" />
            </Pressable>
          </Row>
        </Row>
      </li>
    </ul>
  </Col>
</template>
