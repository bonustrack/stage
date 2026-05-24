<script setup lang="ts">
/** Snapshot.org embeddable widget. SIWE sign-in → channel auto-resume-or-create → messenger view.
 *
 *  Query params:
 *  - `?daemonUrl=https://monitor.metro.box`  — required (the widget has no Settings page).
 *  - `?team=true`                            — include TEAM_WALLETS in the channel (support flow).
 *                                              Default false (butler — solo with agent).
 *
 *  Post-message protocol with host page (snapshot.org):
 *  - `metro:open`   → host shows iframe
 *  - `metro:close`  → host hides iframe
 *  - `metro:resize` → host adjusts iframe height (payload: { height: number })  */

import { createChannel, listChannels, type Channel } from '../lib/channels';
import { clearSession, loadSession, signIn, type AuthSession } from '../lib/siwe';

const route = useRoute();
const router = useRouter();

const daemonUrl = computed(() => String(route.query.daemonUrl ?? ''));
const wantsTeam = computed(() => route.query.team === 'true' || route.query.team === '1');

const session = ref<AuthSession | null>(loadSession());
const channel = ref<Channel | null>(null);
const err = ref('');
const busy = ref(false);

async function doSignIn(): Promise<void> {
  if (!daemonUrl.value) { err.value = 'missing daemonUrl query param'; return; }
  busy.value = true; err.value = '';
  try { session.value = await signIn(daemonUrl.value); }
  catch (e) { err.value = (e as Error).message; }
  finally { busy.value = false; }
}

function doSignOut(): void {
  clearSession();
  session.value = null;
  channel.value = null;
}

/** After sign-in, find or create the channel and route to it.
 *  Butler (no team): pick the first existing channel where I'm the only human + agent.
 *  Support (?team=true): pick the first channel that includes the team OR mint a new one. */
async function resolveChannel(): Promise<void> {
  if (!session.value || !daemonUrl.value) return;
  busy.value = true; err.value = '';
  try {
    const existing = await listChannels(daemonUrl.value, session.value.jwt);
    /** First-match heuristic — good enough for v1; later we can fold members.json
     *  size or wantsTeam into a more deliberate join policy. */
    const match = existing.find(c => c.members.includes(session.value!.sub));
    if (match) {
      channel.value = match;
      void router.replace({ name: 'messenger', query: { line: match.line } });
      return;
    }
    /** No existing channel — mint one. Members = [me, agent] for butler; the host
     *  page can set ?team=true to push the integration layer (later PR) to inject
     *  the team. For now we keep it minimal: just me + the agent. */
    const members = [session.value.sub, 'metro://agent/snapshot'];
    channel.value = await createChannel(daemonUrl.value, session.value.jwt, members);
    void router.replace({ name: 'messenger', query: { line: channel.value.line } });
  } catch (e) { err.value = (e as Error).message; }
  finally { busy.value = false; }
}

watch(session, s => { if (s) void resolveChannel(); }, { immediate: true });

/** Tell the host (snapshot.org) we're ready so it can show the iframe with the right size. */
onMounted(() => {
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'metro:ready', wantsTeam: wantsTeam.value }, '*');
  }
});
</script>

<template>
  <div class="flex flex-col min-h-screen items-center justify-center gap-4 p-6 bg-metro-bg-light dark:bg-metro-bg-dark">
    <div v-if="err" class="text-metro-err text-sm">{{ err }}</div>
    <div v-if="!session">
      <button
        class="px-4 py-2 rounded-lg bg-metro-accent text-white font-medium disabled:opacity-50"
        :disabled="busy"
        @click="doSignIn"
      >
        {{ busy ? 'Signing in…' : 'Sign in with Ethereum' }}
      </button>
    </div>
    <div v-else-if="!channel" class="text-metro-sub-light dark:text-metro-sub-dark text-sm">
      {{ busy ? 'Opening channel…' : 'Ready' }}
    </div>
    <div v-if="session" class="text-xs text-metro-sub-light dark:text-metro-sub-dark">
      <span>{{ session.sub }}</span>
      <button class="ml-2 underline" @click="doSignOut">sign out</button>
    </div>
  </div>
</template>
