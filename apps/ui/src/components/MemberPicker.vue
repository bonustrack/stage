<script setup lang="ts">

import { shortAddress } from '../lib/xmtp';
import { isAddressLike, isDomainLike, resolveDomain } from '@stage-labs/client/stamp/resolve';
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
  <Col :gap="16">
    <!-- Address / ENS entry, mirroring the mobile MemberPicker. -->
    <Col :gap="6">
      <Text size="xs" role="secondary">Add members</Text>
      <Row :gap="8" align="center">
        <Input
          v-model="entry"
          inputType="text"
          placeholder="0x… or name.eth"
          :dark="scheme === 'dark'"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          class="flex-1"
          @submit="onAdd"
        />
        <Button
          variant="secondary"
          size="md"
          :dark="scheme === 'dark'"
          :loading="adding"
          :disabled="!entry.trim()"
          label="Add"
          @click="onAdd"
        />
      </Row>
      <Text v-if="errorMsg" size="xs" role="danger">{{ errorMsg }}</Text>
    </Col>

    <!-- Selected members list with per-row remove, mirroring mobile. Each row
         renders from Kit JSON via the shared memberRow builder (MemberRow.vue). -->
    <Col v-if="props.members.length > 0" :gap="8">
      <MemberRow
        v-for="m in props.members"
        :key="m.address"
        :address="m.address"
        :name="m.label !== shortAddress(m.address) ? m.label : null"
        :is-self="false"
        :removing="false"
        :can-remove="true"
        @remove="emit('remove', m.address)"
      />
    </Col>
  </Col>
</template>
