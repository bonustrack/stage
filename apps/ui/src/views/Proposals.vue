<script setup lang="ts">

import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { useEffectiveScheme } from '@/lib/kitTheme';
import { useProposals, type ProposalDetail } from '../lib/useProposals';
import type { QueuedRequest, RequestKind } from '@stage-labs/client/xmtp/requests-queue';
import { acceptRequestConv, blockRequestConv } from '../lib/xmtpRequests';
import { xmtpVote } from '../lib/xmtpSend';

const router = useRouter();
const scheme = useEffectiveScheme();
const palette = useKitPalette();
const dark = computed(() => scheme.value === 'dark');
const acceptBg = computed(() => (dark.value ? '#15321f' : '#dcf5e6'));
const acceptFg = computed(() => (dark.value ? '#34d399' : '#15803d'));

const { requests, details, loading, error, refresh } = useProposals();

const KIND_LABEL: Record<RequestKind, string> = {
  poll: 'Poll',
  payment: 'Payment request',
  signing: 'Signing request',
  message: 'Message request',
};

const skipped = ref<Set<string>>(new Set());
const seen = ref(0);

const pending = computed(() => (requests.value ?? []).filter(r => !skipped.value.has(r.key)));
const current = computed<QueuedRequest | null>(() => pending.value[0] ?? null);
const total = computed(() => seen.value + pending.value.length);
const position = computed(() => (pending.value.length === 0 ? 0 : seen.value + 1));

watch(requests, () => { skipped.value = new Set(); seen.value = 0; });

function advance(): void {
  const cur = current.value;
  if (!cur) return;
  const next = new Set(skipped.value);
  next.add(cur.key);
  skipped.value = next;
  seen.value += 1;
}

function onRefresh(): void {
  skipped.value = new Set();
  seen.value = 0;
  void refresh();
}

function detailOf(req: QueuedRequest): ProposalDetail | undefined {
  return details.value.get(req.key);
}

function paymentMetadata(req: QueuedRequest): { description?: string; amount?: number; currency?: string } {
  const calls = detailOf(req)?.payment?.calls;
  return calls?.[0]?.metadata ?? {};
}

function paymentPreview(req: QueuedRequest): string {
  const meta = paymentMetadata(req);
  const description = meta.description?.trim();
  if (description) return description;
  if (meta.amount == null) return 'Transaction request';
  const amount = `${meta.amount} ${meta.currency ?? ''}`.trim();
  return `Send ${amount}`;
}

function signingPreview(req: QueuedRequest): string {
  const sig = detailOf(req)?.signing;
  return sig?.description?.trim() ?? sig?.message?.trim() ?? 'Signature request';
}

function messagePreview(req: QueuedRequest): string {
  const preview = req.request?.preview?.trim();
  if (preview) return preview;
  return '(no messages yet)';
}

function openConversation(req: QueuedRequest): void {
  const target = req.msgId ? `/xmtp/${req.convId}?m=${req.msgId}` : `/xmtp/${req.convId}`;
  void router.push(target);
}

async function onVote(
  req: QueuedRequest, questionIndex: number, optionIndex: number, action: 'added' | 'removed',
): Promise<void> {
  const poll = detailOf(req)?.poll;
  if (!poll || !req.msgId) return;
  await xmtpVote(poll.line, req.msgId, optionIndex, action, questionIndex).catch(() => undefined);
  advance();
}

async function onMessageAct(req: QueuedRequest, accept: boolean): Promise<void> {
  advance();
  if (accept) await acceptRequestConv(req.convId).catch(() => undefined);
  else await blockRequestConv(req.convId).catch(() => undefined);
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
      <Title size="sm">Pending requests</Title>
      <Col class="flex-1" />
      <Button
        v-if="requests !== null"
        variant="secondary"
        size="md"
        label="Refresh"
        :dark="dark"
        :loading="loading"
        @click="onRefresh()"
      />
    </Row>

    <Col v-if="requests === null" align="center" justify="center" class="flex-1">
      <Spinner :size="28" />
    </Col>
    <Col v-else-if="error" align="center" justify="center" class="flex-1" :padding="32">
      <Text role="secondary" text-align="center">{{ error }}</Text>
    </Col>
    <Col v-else-if="current === null" align="center" justify="center" class="flex-1" :padding="32" :gap="6">
      <Text size="3xl" weight="semibold" color="text">No pending requests</Text>
      <Text role="secondary" text-align="center">Polls, payments, signatures, and message requests will show up here.</Text>
    </Col>

    <!-- Stepper: one request at a time with an "X of Y" counter, mirroring mobile ProposalsScreen. -->
    <Col v-else class="flex-1 min-h-0 overflow-y-auto no-scrollbar">
      <Row align="center" :gap="8" class="px-4 pt-4">
        <Text size="xs" role="secondary">{{ position }} of {{ total }}</Text>
        <Col class="flex-1" />
        <Pressable
          tag="button"
          type="button"
          class="px-2 py-1"
          title="Skip"
          @click="advance()"
        >
          <Text size="sm" color="link">Skip</Text>
        </Pressable>
      </Row>

      <Col :key="current.key" class="px-4 py-4">
        <Text
          size="2xs"
          weight="semibold"
          role="secondary"
          class="uppercase tracking-wide"
        >{{ KIND_LABEL[current.kind] }}</Text>

        <template v-if="current.kind === 'message'">
          <Col class="mt-2" :gap="10">
            <ChannelRow
              :avatar-address="current.request?.avatarAddress ?? null"
              :avatar-uri="current.request?.avatarUri ?? null"
              :title="current.request?.title ?? ''"
              :last-ts="null"
              :last-preview="messagePreview(current)"
              :unread-count="0"
              @open="openConversation(current)"
            />
            <Row :gap="8">
              <Pressable
                tag="button"
                type="button"
                class="flex items-center justify-center"
                title="Block"
                :style="{ width: '36px', height: '36px', borderRadius: '18px', borderWidth: '1px', borderStyle: 'solid', borderColor: palette.border }"
                @click="onMessageAct(current, false)"
              >
                <Icon name="x" :size="18" :color="palette.danger" />
              </Pressable>
              <Pressable
                tag="button"
                type="button"
                class="flex items-center justify-center"
                title="Accept"
                :style="{ width: '36px', height: '36px', borderRadius: '18px', backgroundColor: acceptBg }"
                @click="onMessageAct(current, true)"
              >
                <Icon name="check" :size="18" :color="acceptFg" />
              </Pressable>
            </Row>
          </Col>
        </template>

        <template v-else-if="current.kind === 'poll' && detailOf(current)?.poll">
          <PollCard
            :poll="detailOf(current)!.poll!.poll"
            :votes="detailOf(current)!.poll!.votes"
            :own-votes="detailOf(current)!.poll!.ownVotes"
            @vote="onVote(current, $event.questionIndex, $event.optionIndex, $event.action)"
          />
          <Pressable
            tag="button"
            type="button"
            class="mt-3 text-left"
            @click="openConversation(current)"
          >
            <Text size="sm" color="link">Open in conversation</Text>
          </Pressable>
        </template>

        <template v-else>
          <Col class="mt-2" :gap="10">
            <Text size="lg" weight="medium" :style="{ color: palette.text }">
              {{ current.kind === 'payment' ? paymentPreview(current) : signingPreview(current) }}
            </Text>
            <Pressable
              tag="button"
              type="button"
              class="self-start px-3 py-2 rounded-lg border text-left"
              :style="{ borderColor: palette.border }"
              @click="openConversation(current)"
            >
              <Text size="sm" color="link">Open in conversation</Text>
            </Pressable>
          </Col>
        </template>
      </Col>
    </Col>
  </Col>
</template>
