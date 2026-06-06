<script setup lang="ts">
/** Edit-profile sheet: same fields as the mobile counterpart. Picks an avatar
 *  file (JPEG/PNG → pineapple → ipfs://), signs EIP-712 with the local viem
 *  account, POSTs to the Snapshot sequencer. */

import { type SnapshotProfile, updateProfile, uploadAvatar } from '../lib/profile';
import { PROFILE_FIELD_LIMITS } from '@stage-labs/client/profile/snapshot';
import { stampAvatarUrl } from '../lib/xmtp';

const props = defineProps<{ open: boolean; address: string; initial: SnapshotProfile }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved', next: SnapshotProfile): void }>();

interface Field { key: keyof SnapshotProfile; label: string; placeholder: string; multiline?: boolean }
const FIELDS: Field[] = [
  { key: 'name', label: 'Name', placeholder: 'Display name' },
  { key: 'about', label: 'About', placeholder: 'Tell your story', multiline: true },
  { key: 'github', label: 'GitHub', placeholder: 'GitHub handle' },
  { key: 'twitter', label: 'X (Twitter)', placeholder: 'X handle' },
  { key: 'lens', label: 'Lens', placeholder: 'Lens handle' },
  { key: 'farcaster', label: 'Farcaster', placeholder: 'Farcaster handle' },
];

const form = ref<SnapshotProfile>({ ...props.initial });
const saving = ref(false);
const uploading = ref(false);
const error = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

watch(() => [props.open, props.initial] as const, ([open]) => {
  if (open) { form.value = { ...props.initial }; error.value = null; }
});

function update(k: keyof SnapshotProfile, v: string): void {
  const max = (PROFILE_FIELD_LIMITS as Record<string, number>)[k];
  (form.value as Record<string, string>)[k] = max ? v.slice(0, max) : v;
}

async function onPickFile(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true; error.value = null;
  try {
    const url = await uploadAvatar(file);
    form.value = { ...form.value, avatar: url };
  } catch (err) { error.value = (err as Error).message; }
  finally { uploading.value = false; if (fileInput.value) fileInput.value.value = ''; }
}

async function save(): Promise<void> {
  saving.value = true; error.value = null;
  try {
    await updateProfile(form.value);
    emit('saved', { ...form.value });
    emit('close');
  } catch (err) { error.value = (err as Error).message; }
  finally { saving.value = false; }
}
</script>

<template>
  <div v-if="open"
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center
      bg-black/60 backdrop-blur-sm"
    @click.self="emit('close')">
    <div class="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl
      bg-metro-bg-light dark:bg-metro-bg-dark
      border-t sm:border border-metro-border-light dark:border-metro-border-dark
      max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between px-4 py-3 border-b border-metro-border-light dark:border-metro-border-dark">
        <button type="button" class="text-metro-sub-light dark:text-metro-sub-dark text-sm" :disabled="saving" @click="emit('close')">Cancel</button>
        <div class="font-head text-metro-head-light dark:text-metro-head-dark text-base">Edit profile</div>
        <button type="button" class="font-head text-sm"
          :class="saving || uploading ? 'text-metro-sub-light dark:text-metro-sub-dark' : 'text-metro-head-light dark:text-metro-head-dark'"
          :disabled="saving || uploading" @click="save">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
      <div class="overflow-y-auto p-4">
        <div class="flex flex-col items-center mb-5">
          <button type="button" :disabled="uploading"
            class="relative rounded-full overflow-hidden bg-metro-surface-light dark:bg-metro-surface-dark disabled:opacity-50"
            @click="fileInput?.click()">
            <img :src="stampAvatarUrl(address, 192)" alt="" class="w-24 h-24 rounded-full object-cover" />
            <div v-if="uploading" class="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs">…</div>
          </button>
          <div class="text-xs text-metro-sub-light dark:text-metro-sub-dark mt-2">Tap to change avatar</div>
          <input ref="fileInput" type="file" accept="image/jpeg,image/jpg,image/png" class="hidden" @change="onPickFile" />
        </div>

        <div v-if="error" class="mb-3 p-2 rounded-lg bg-metro-err/20 text-metro-err text-xs">{{ error }}</div>

        <div v-for="f in FIELDS" :key="f.key" class="mb-3">
          <label class="block text-[11px] text-metro-sub-light dark:text-metro-sub-dark mb-1">{{ f.label.toUpperCase() }}</label>
          <textarea v-if="f.multiline" :value="(form[f.key] ?? '') as string"
            :placeholder="f.placeholder" rows="3"
            class="w-full bg-metro-surface-light dark:bg-metro-surface-dark border border-metro-border-light dark:border-metro-border-dark rounded-xl p-3 text-sm text-metro-fg-light dark:text-metro-fg-dark"
            @input="update(f.key, ($event.target as HTMLTextAreaElement).value)" />
          <input v-else type="text" :value="(form[f.key] ?? '') as string"
            :placeholder="f.placeholder"
            class="w-full bg-metro-surface-light dark:bg-metro-surface-dark border border-metro-border-light dark:border-metro-border-dark rounded-xl p-3 text-sm text-metro-fg-light dark:text-metro-fg-dark"
            @input="update(f.key, ($event.target as HTMLInputElement).value)" />
        </div>
      </div>
    </div>
  </div>
</template>
