<script setup lang="ts">
/** Group detail view — list members (avatar + short address; click → user
 *  profile), inline-editable group name, add by 0x address, remove with
 *  confirm. Web counterpart to apps/app/app/group/[convId].tsx. */

import { IdentifierKind } from '@xmtp/browser-sdk';
import {
  convOfLine, getCachedXmtpClient, getOrCreateXmtpClient, lineOfConv,
  memberInboxToAddressMap, shortAddress, stampBoxAvatarUrl,
} from '../lib/xmtp';
import { readProfile } from '../lib/profile';
import type { SnapshotProfile } from '@shared/profile/snapshot';

const route = useRoute();
const router = useRouter();

const convId = computed(() => (route.params.convId as string) ?? '');
const line = computed(() => lineOfConv(convId.value));

const name = ref<string | null>(null);
const draft = ref('');
const editing = ref(false);
const saving = ref(false);
const members = ref<string[]>([]);
const memberNames = ref<Record<string, string | null>>({});
const addDraft = ref('');
const adding = ref(false);
const selfAddress = ref('');
const removing = ref<string | null>(null);
const errorMsg = ref('');

watchEffect(async () => {
  if (!convId.value) return;
  const c = getCachedXmtpClient();
  if (c) selfAddress.value = c.accountIdentifier?.identifier.toLowerCase() ?? '';
  else {
    const client = await getOrCreateXmtpClient('production').catch(() => null);
    if (client) selfAddress.value = client.accountIdentifier?.identifier.toLowerCase() ?? '';
  }
  const conv = await convOfLine(line.value);
  if (!conv) return;
  const groupName = (conv as unknown as { name?: string | (() => Promise<string>) }).name;
  const resolvedName = typeof groupName === 'function' ? await groupName() : groupName ?? '';
  name.value = resolvedName ?? '';
  draft.value = resolvedName ?? '';
  const addrMap = await memberInboxToAddressMap(conv);
  const addrs = Object.values(addrMap).sort((a, b) => a.localeCompare(b));
  members.value = addrs;
  /** Enrich with Snapshot profile names — pure best-effort, rows fall back
   *  to short addresses when the lookup misses. */
  const profiles = await Promise.all(
    addrs.map(a => readProfile(a).catch(() => null as SnapshotProfile | null)),
  );
  const next: Record<string, string | null> = {};
  for (let i = 0; i < addrs.length; i++) next[addrs[i]!] = profiles[i]?.name?.trim() || null;
  memberNames.value = next;
});

async function saveName(): Promise<void> {
  const next = draft.value.trim();
  if (!next || saving.value) return;
  saving.value = true;
  errorMsg.value = '';
  try {
    const conv = await convOfLine(line.value);
    const group = conv as unknown as { updateName?: (n: string) => Promise<void> };
    if (!group.updateName) throw new Error('Not a group conversation');
    await group.updateName(next);
    name.value = next;
    editing.value = false;
  } catch (e) {
    errorMsg.value = `Rename failed: ${(e as Error).message}`;
  } finally { saving.value = false; }
}

async function addMember(): Promise<void> {
  const addr = addDraft.value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr) || adding.value) {
    errorMsg.value = 'Enter a valid 0x… Ethereum address.';
    return;
  }
  adding.value = true;
  errorMsg.value = '';
  try {
    const conv = await convOfLine(line.value);
    if (!conv) throw new Error('Conversation not found');
    const group = conv as unknown as {
      addMembersByIdentifiers?: (ids: { identifier: string; identifierKind: IdentifierKind }[]) => Promise<unknown>;
    };
    if (!group.addMembersByIdentifiers) throw new Error('Not a group conversation');
    await group.addMembersByIdentifiers([{ identifier: addr.toLowerCase(), identifierKind: IdentifierKind.Ethereum }]);
    addDraft.value = '';
    const fullMap = await memberInboxToAddressMap(conv);
    members.value = Object.values(fullMap).sort((a, b) => a.localeCompare(b));
  } catch (e) {
    errorMsg.value = `Add failed: ${(e as Error).message}`;
  } finally { adding.value = false; }
}

async function removeMember(addr: string): Promise<void> {
  if (!confirm(`Remove ${shortAddress(addr)} from this group?`)) return;
  removing.value = addr.toLowerCase();
  errorMsg.value = '';
  try {
    const conv = await convOfLine(line.value);
    if (!conv) throw new Error('Conversation not found');
    const group = conv as unknown as {
      removeMembersByIdentifiers?: (ids: { identifier: string; identifierKind: IdentifierKind }[]) => Promise<unknown>;
    };
    if (!group.removeMembersByIdentifiers) throw new Error('Not a group conversation');
    await group.removeMembersByIdentifiers([{ identifier: addr.toLowerCase(), identifierKind: IdentifierKind.Ethereum }]);
    const fullMap = await memberInboxToAddressMap(conv);
    members.value = Object.values(fullMap).sort((a, b) => a.localeCompare(b));
  } catch (e) {
    errorMsg.value = `Remove failed: ${(e as Error).message}`;
  } finally { removing.value = null; }
}

function openMember(addr: string): void { void router.push(`/user/${addr}`); }
</script>

<template>
  <div class="min-h-screen bg-metro-bg-light dark:bg-metro-bg-dark">
    <div class="flex items-center px-3 py-3">
      <button type="button" class="p-1.5" @click="router.back()">
        <HeroIcon name="arrowLeft" :size="22" />
      </button>
    </div>

    <div class="px-4 pt-2 pb-4">
      <div class="text-[11px] uppercase tracking-wide text-metro-sub-light dark:text-metro-sub-dark">Group name</div>
      <div v-if="editing" class="flex items-center gap-2 mt-1.5">
        <input
          v-model="draft"
          type="text"
          placeholder="Group name"
          autofocus
          class="flex-1 bg-metro-surface-light dark:bg-metro-surface-dark
            border border-metro-border-light dark:border-metro-border-dark
            rounded-lg px-3 py-2 text-base text-metro-fg-light dark:text-metro-fg-dark outline-none"
        />
        <button
          type="button"
          :disabled="saving || !draft.trim()"
          class="px-3.5 py-2 rounded-full bg-metro-fg-light dark:bg-metro-fg-dark
            text-metro-bg-light dark:text-metro-bg-dark text-sm disabled:opacity-50"
          @click="saveName"
        >
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
      <button v-else type="button" class="mt-1.5 block text-left" @click="editing = true">
        <div class="text-xl text-metro-fg-light dark:text-metro-fg-dark font-head">
          {{ name && name.trim() ? name : 'Untitled group' }}
        </div>
        <div class="text-xs text-metro-sub-light dark:text-metro-sub-dark mt-0.5">Tap to rename</div>
      </button>
    </div>

    <div class="text-[11px] uppercase tracking-wide text-metro-sub-light dark:text-metro-sub-dark px-4 pb-1.5">
      Members ({{ members.length }})
    </div>
    <div class="flex gap-2 px-4 pb-3">
      <input
        v-model="addDraft"
        type="text"
        placeholder="0x… Ethereum address"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        class="flex-1 bg-metro-surface-light dark:bg-metro-surface-dark
          border border-metro-border-light dark:border-metro-border-dark
          rounded-lg px-3 py-2 text-sm text-metro-fg-light dark:text-metro-fg-dark outline-none"
      />
      <button
        type="button"
        :disabled="adding || !addDraft.trim()"
        class="px-3.5 py-2 rounded-full bg-metro-fg-light dark:bg-metro-fg-dark
          text-metro-bg-light dark:text-metro-bg-dark text-sm disabled:opacity-50"
        @click="addMember"
      >
        {{ adding ? 'Adding…' : 'Add' }}
      </button>
    </div>
    <div v-if="errorMsg" class="px-4 pb-2 text-xs text-red-500">{{ errorMsg }}</div>

    <ul class="flex flex-col">
      <li v-for="addr in members" :key="addr.toLowerCase()"
        class="flex items-center gap-3 px-3.5 py-2.5
          bg-metro-surface-light dark:bg-metro-surface-dark
          border-b border-metro-border-light dark:border-metro-border-dark"
        :class="{ 'opacity-50': removing === addr.toLowerCase() }"
      >
        <button type="button" class="flex items-center gap-3 flex-1 min-w-0 text-left" @click="openMember(addr)">
          <img :src="stampBoxAvatarUrl(addr, 64)" alt="" class="w-8 h-8 rounded-full bg-metro-border-dark" />
          <div class="flex-1 min-w-0">
            <div class="text-sm text-metro-fg-light dark:text-metro-fg-dark truncate font-head">
              {{ memberNames[addr] || shortAddress(addr) }}{{ addr.toLowerCase() === selfAddress ? ' (you)' : '' }}
            </div>
            <div v-if="memberNames[addr]" class="text-xs text-metro-sub-light dark:text-metro-sub-dark truncate mt-0.5">
              {{ shortAddress(addr) }}
            </div>
          </div>
        </button>
        <button
          v-if="addr.toLowerCase() !== selfAddress"
          type="button"
          :disabled="removing === addr.toLowerCase()"
          class="p-1.5 rounded-full text-red-500 hover:bg-red-500/10 disabled:opacity-50"
          @click="removeMember(addr)"
        >
          <HeroIcon name="trash" :size="18" />
        </button>
      </li>
    </ul>
  </div>
</template>
