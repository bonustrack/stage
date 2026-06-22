<script setup lang="ts">

import { computed } from 'vue';
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
  await refresh();
}

async function onMessageAct(req: QueuedRequest, accept: boolean): Promise<void> {
  const prev = requests.value;
  requests.value = (requests.value ?? []).filter(r => r.key !== req.key);
  try {
    if (accept) await acceptRequestConv(req.convId);
    else await blockRequestConv(req.convId);
  } catch {
    requests.value = prev;
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
      <Title size="sm">Pending requests</Title>
      <Col class="flex-1" />
      <Pressable
        v-if="requests !== null"
        tag="button"
        type="button"
        class="p-2 rounded-lg hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
        :disabled="loading"
        title="Refresh"
        @click="refresh()"
      >
        <Icon name="arrowDown" :size="16" :color="palette.sub" :class="loading ? 'animate-spin' : ''" />
      </Pressable>
    </Row>

    <Col v-if="requests === null" align="center" justify="center" class="flex-1">
      <Spinner :size="28" />
    </Col>
    <Col v-else-if="error" align="center" justify="center" class="flex-1" :padding="32">
      <Text role="secondary" text-align="center">{{ error }}</Text>
    </Col>
    <Col v-else-if="requests.length === 0" align="center" justify="center" class="flex-1" :padding="32" :gap="6">
      <Text size="2xl" weight="semibold" color="link">No pending requests</Text>
      <Text role="secondary" text-align="center">Polls, payments, signatures, and message requests will show up here.</Text>
    </Col>

    <ul v-else class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-6">
      <li
        v-for="req in requests"
        :key="req.key"
        class="px-4 py-4 border-b border-metro-border-light dark:border-metro-border-dark"
      >
        <Text
          size="2xs"
          weight="semibold"
          role="secondary"
          class="uppercase tracking-wide"
        >{{ KIND_LABEL[req.kind] }}</Text>

        <template v-if="req.kind === 'message'">
          <Col class="mt-2" :gap="10">
            <ChannelRow
              :avatar-address="req.request?.avatarAddress ?? null"
              :avatar-uri="req.request?.avatarUri ?? null"
              :title="req.request?.title ?? ''"
              :last-ts="null"
              :last-preview="messagePreview(req)"
              :unread-count="0"
              @open="openConversation(req)"
            />
            <Row :gap="8">
              <Pressable
                tag="button"
                type="button"
                class="flex items-center justify-center"
                title="Block"
                :style="{ width: '36px', height: '36px', borderRadius: '18px', borderWidth: '1px', borderStyle: 'solid', borderColor: palette.border }"
                @click="onMessageAct(req, false)"
              >
                <Icon name="x" :size="18" :color="palette.danger" />
              </Pressable>
              <Pressable
                tag="button"
                type="button"
                class="flex items-center justify-center"
                title="Accept"
                :style="{ width: '36px', height: '36px', borderRadius: '18px', backgroundColor: acceptBg }"
                @click="onMessageAct(req, true)"
              >
                <Icon name="check" :size="18" :color="acceptFg" />
              </Pressable>
            </Row>
          </Col>
        </template>

        <template v-else-if="req.kind === 'poll' && detailOf(req)?.poll">
          <PollCard
            :poll="detailOf(req)!.poll!.poll"
            :votes="detailOf(req)!.poll!.votes"
            :own-votes="detailOf(req)!.poll!.ownVotes"
            @vote="onVote(req, $event.questionIndex, $event.optionIndex, $event.action)"
          />
          <Pressable
            tag="button"
            type="button"
            class="mt-3 text-left"
            @click="openConversation(req)"
          >
            <Text size="sm" color="link">Open in conversation</Text>
          </Pressable>
        </template>

        <template v-else>
          <Col class="mt-2" :gap="10">
            <Text size="lg" weight="medium" :style="{ color: palette.text }">
              {{ req.kind === 'payment' ? paymentPreview(req) : signingPreview(req) }}
            </Text>
            <Pressable
              tag="button"
              type="button"
              class="self-start px-3 py-2 rounded-lg border text-left"
              :style="{ borderColor: palette.border }"
              @click="openConversation(req)"
            >
              <Text size="sm" color="link">Open in conversation</Text>
            </Pressable>
          </Col>
        </template>
      </li>
    </ul>
  </Col>
</template>
