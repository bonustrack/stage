<script setup lang="ts">

import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { basicRoot, screenHeader, SCREEN_BACK } from '@stage-labs/views';
import { useEffectiveScheme } from '@/lib/kitTheme';
import { useProposals, type ProposalDetail } from '../lib/useProposals';
import type { QueuedRequest, RequestKind } from '@stage-labs/client/xmtp/requests-queue';
import { acceptRequestConv, blockRequestConv } from '../lib/xmtpRequests';
import { xmtpVote, xmtpSendText, xmtpSendSignatureReference } from '../lib/xmtpSend';
import { executeTxRequest } from '../lib/executeTxRequest';
import { signRequest } from '../lib/signRequest';
import { explorerTxUrl } from '@stage-labs/client/xmtp/tx';
import { friendlyTxError } from '@stage-labs/client/wallet/txError';
import { lineOfConv } from '../lib/xmtp';
import type { Hex } from 'viem';

const router = useRouter();
const scheme = useEffectiveScheme();
const palette = useKitPalette();
const dark = computed(() => scheme.value === 'dark');
const acceptBg = computed(() => (dark.value ? '#15321f' : '#dcf5e6'));
const acceptFg = computed(() => (dark.value ? '#34d399' : '#15803d'));

const { requests, details, loading, error, refresh } = useProposals();

const headerNode = computed(() =>
  basicRoot(screenHeader({
    title: 'Pending requests',
    titleStyle: { kind: 'title', size: 'sm' },
    backColor: palette.link,
    safeTop: 0,
    surface: palette.toolbarBg,
    borderColor: palette.border,
  })),
);
const headerActions = {
  [SCREEN_BACK]: (): void => { router.back(); },
};

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

type PayState = 'idle' | 'confirm' | 'pending' | 'done' | 'error';
const payState = ref<PayState>('idle');
const payHash = ref<Hex | null>(null);
const payErr = ref<string | null>(null);

const payExplorerUrl = computed(() =>
  (payHash.value ? explorerTxUrl(8453, payHash.value) : ''));

type SignState = 'idle' | 'confirm' | 'pending' | 'done' | 'error';
const signState = ref<SignState>('idle');
const signErr = ref<string | null>(null);

watch(current, () => {
  payState.value = 'idle';
  payHash.value = null;
  payErr.value = null;
  signState.value = 'idle';
  signErr.value = null;
});

function startSignConfirm(): void {
  signErr.value = null;
  signState.value = 'confirm';
}

function cancelSignConfirm(): void {
  signState.value = 'idle';
}

async function onSign(req: QueuedRequest): Promise<void> {
  const content = detailOf(req)?.signing;
  if (!content) return;
  signState.value = 'pending';
  signErr.value = null;
  try {
    const ref = await signRequest(content);
    await xmtpSendSignatureReference(lineOfConv(req.convId), ref);
    signState.value = 'done';
  } catch (e) {
    signErr.value = friendlyTxError(e, 'Signing failed');
    signState.value = 'error';
  }
}

function startConfirm(): void {
  payErr.value = null;
  payState.value = 'confirm';
}

function cancelConfirm(): void {
  payState.value = 'idle';
}

async function onExecute(req: QueuedRequest): Promise<void> {
  const content = detailOf(req)?.payment;
  if (!content) return;
  payState.value = 'pending';
  payErr.value = null;
  try {
    const { txHash } = await executeTxRequest(content);
    payHash.value = txHash;
    payState.value = 'done';
    const desc = paymentPreview(req);
    await xmtpSendText(lineOfConv(req.convId), `Sent transaction: ${desc} (${txHash})`)
      .catch(() => undefined);
  } catch (e) {
    payErr.value = friendlyTxError(e, 'Transaction failed');
    payState.value = 'error';
  }
}
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <ViewHost :node="headerNode" :actions="headerActions" />

    <Col v-if="requests === null" align="center" justify="center" class="flex-1">
      <Spinner :size="28" />
    </Col>
    <Col v-else-if="error" align="center" justify="center" class="flex-1" :padding="32">
      <Text role="secondary" text-align="center">{{ error }}</Text>
    </Col>
    <Col v-else-if="current === null" align="center" justify="center" class="flex-1" :padding="24" :gap="12">
      <Text size="3xl" color="text" :style="{ opacity: '0.85' }">{{ loading ? 'Loading requests…' : 'No pending requests' }}</Text>
      <Button v-if="!loading" variant="secondary" size="md" label="Refresh" :dark="dark" @click="onRefresh()" />
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

            <template v-if="current.kind === 'payment' && detailOf(current)?.payment">
              <Text size="xs" role="secondary">Gas sponsored on Base.</Text>

              <Col v-if="payState === 'done'" :gap="6">
                <Row align="center" :gap="8">
                  <Icon name="check" :size="18" :color="acceptFg" />
                  <Text size="md" weight="semibold" :style="{ color: palette.text }">Sent</Text>
                </Row>
                <Pressable tag="a" :href="payExplorerUrl" target="_blank" rel="noreferrer">
                  <Text size="sm" color="link">View on explorer</Text>
                </Pressable>
              </Col>

              <Col v-else-if="payState === 'pending'" :gap="6">
                <Row align="center" :gap="8">
                  <Spinner :size="18" />
                  <Text size="sm" role="secondary">Executing sponsored transaction…</Text>
                </Row>
              </Col>

              <Col v-else-if="payState === 'confirm'" :gap="8">
                <Text size="sm" role="secondary">Approve and execute this transaction with your smart account?</Text>
                <Row :gap="8">
                  <Button variant="secondary" size="md" label="Cancel" :dark="dark" @click="cancelConfirm()" />
                  <Button variant="primary" size="md" label="Confirm" :dark="dark" @click="onExecute(current)" />
                </Row>
              </Col>

              <Col v-else :gap="8">
                <Text v-if="payState === 'error' && payErr" size="sm" :style="{ color: palette.danger }">{{ payErr }}</Text>
                <Button
                  variant="primary"
                  size="md"
                  :label="payState === 'error' ? 'Retry' : 'Approve'"
                  :dark="dark"
                  class="self-start"
                  @click="startConfirm()"
                />
              </Col>
            </template>

            <template v-if="current.kind === 'signing' && detailOf(current)?.signing">
              <Text size="xs" role="secondary">Sign this with your active account.</Text>

              <Col v-if="signState === 'done'" :gap="6">
                <Row align="center" :gap="8">
                  <Icon name="check" :size="18" :color="acceptFg" />
                  <Text size="md" weight="semibold" :style="{ color: palette.text }">Signed</Text>
                </Row>
              </Col>

              <Col v-else-if="signState === 'pending'" :gap="6">
                <Row align="center" :gap="8">
                  <Spinner :size="18" />
                  <Text size="sm" role="secondary">Signing…</Text>
                </Row>
              </Col>

              <Col v-else-if="signState === 'confirm'" :gap="8">
                <Text size="sm" role="secondary">Approve and sign this request with your active account?</Text>
                <Row :gap="8">
                  <Button variant="secondary" size="md" label="Cancel" :dark="dark" @click="cancelSignConfirm()" />
                  <Button variant="primary" size="md" label="Sign" :dark="dark" @click="onSign(current)" />
                </Row>
              </Col>

              <Col v-else :gap="8">
                <Text v-if="signState === 'error' && signErr" size="sm" :style="{ color: palette.danger }">{{ signErr }}</Text>
                <Button
                  variant="primary"
                  size="md"
                  :label="signState === 'error' ? 'Retry' : 'Approve'"
                  :dark="dark"
                  class="self-start"
                  @click="startSignConfirm()"
                />
              </Col>
            </template>

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
