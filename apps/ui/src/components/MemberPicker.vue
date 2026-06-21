<script setup lang="ts">

import { stampAvatarUrl, shortAddress } from '../lib/xmtp';
import { isAddressLike, isDomainLike, resolveDomain } from '../lib/stamp';
import { useEffectiveScheme } from '@/lib/kitTheme';
import type { PickedMember } from '../lib/memberPicker';

const scheme = useEffectiveScheme();

const props = defineProps<{
  members: PickedMember[];
  exclude?: string[];
}>();
const emit = defineEmits<{
  (e: 'add', member: PickedMember): void;
  (e: 'remove', address: string): void;
}>();

const entry = ref('');
const adding = ref(false);
const errorMsg = ref('');

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

async function resolveEntry(raw: string): Promise<PickedMember | null> {
  if (isAddressLike(raw) && ADDR_RE.test(raw)) {
    return { address: raw, label: shortAddress(raw) };
  }
  if (isDomainLike(raw)) {
    const address = await resolveDomain(raw.toLowerCase());
    if (!address) { errorMsg.value = `Couldn't resolve ${raw}`; return null; }
    return { address, label: raw };
  }
  errorMsg.value = 'Enter a 0x address or a .eth name';
  return null;
}

function isDuplicate(lower: string): boolean {
  if (props.exclude?.some(a => a.toLowerCase() === lower)) {
    errorMsg.value = 'Already in this group';
    return true;
  }
  if (props.members.some(m => m.address.toLowerCase() === lower)) {
    errorMsg.value = 'Already added';
    return true;
  }
  return false;
}

async function onAdd(): Promise<void> {
  const raw = entry.value.trim();
  if (!raw || adding.value) return;
  adding.value = true;
  errorMsg.value = '';
  try {
    const member = await resolveEntry(raw);
    if (!member) return;
    if (isDuplicate(member.address.toLowerCase())) { entry.value = ''; return; }
    emit('add', member);
    entry.value = '';
  } catch (err) {
    errorMsg.value = (err as Error)?.message ?? 'Failed to add member';
  } finally {
    adding.value = false;
  }
}
</script>

<template>
  <Col :gap="12">
    <!-- Address / ENS entry, mirroring the mobile MemberPicker. -->
    <Col :gap="6">
      <Label class="text-xs text-metro-sub-light dark:text-metro-sub-dark">Add members</Label>
      <Row :gap="8" align="center">
        <Input
          v-model="entry"
          inputType="text"
          placeholder="0x… or name.eth"
          :dark="scheme === 'dark'"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          class="flex-1 bg-metro-surface-light dark:bg-metro-surface-dark
            border border-metro-border-light dark:border-metro-border-dark
            rounded-lg px-3 py-2 text-sm text-metro-fg-light dark:text-metro-fg-dark outline-none font-sans"
          @keydown.enter.exact.prevent="onAdd"
        />
        <Pressable
          tag="button"
          type="button"
          :disabled="adding || !entry.trim()"
          class="px-3.5 py-2 rounded-full bg-metro-head-light dark:bg-metro-head-dark
            text-metro-bg-light dark:text-metro-bg-dark text-sm font-head disabled:opacity-50"
          @click="onAdd"
        >
          {{ adding ? 'Adding…' : 'Add' }}
        </Pressable>
      </Row>
      <Col v-if="errorMsg" class="text-xs text-metro-err">{{ errorMsg }}</Col>
    </Col>

    <!-- Selected members list with per-row remove, mirroring mobile. -->
    <Col v-if="props.members.length > 0" :gap="8">
      <Row
        v-for="m in props.members"
        :key="m.address"
        align="center"
        :gap="10"
        class="p-2 rounded-lg border border-metro-border-light dark:border-metro-border-dark
          bg-metro-surface-light dark:bg-metro-surface-dark"
      >
        <img
          :src="stampAvatarUrl(m.address, 64)"
          alt=""
          class="w-8 h-8 rounded-full bg-metro-border-dark shrink-0 object-cover"
        />
        <Col class="flex-1 min-w-0">
          <Col class="text-sm text-metro-head-light dark:text-metro-head-dark truncate font-head">
            {{ m.label }}
          </Col>
          <Col
            v-if="m.label !== shortAddress(m.address)"
            class="text-xs text-metro-sub-light dark:text-metro-sub-dark truncate"
          >
            {{ shortAddress(m.address) }}
          </Col>
        </Col>
        <Pressable
          tag="button"
          type="button"
          class="w-7 h-7 rounded-full flex items-center justify-center
            border border-metro-border-light dark:border-metro-border-dark
            text-metro-sub-light dark:text-metro-sub-dark shrink-0"
          @click="emit('remove', m.address)"
        >
          <Icon name="x" :size="16" />
        </Pressable>
      </Row>
    </Col>
  </Col>
</template>
