
import { onUnmounted, ref, type Ref } from 'vue';

const overrideActive = ref(false);

export function useTopnavOverride(): Ref<boolean> {
  return overrideActive;
}

export function setTopnavOverride(active: boolean): void {
  overrideActive.value = active;
}

export function usePublishTopnav(): { setOverride: (active: boolean) => void } {
  onUnmounted(() => { overrideActive.value = false; });
  return { setOverride: setTopnavOverride };
}
