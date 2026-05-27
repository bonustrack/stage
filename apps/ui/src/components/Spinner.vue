<script setup lang="ts">
/** Loading spinner mirroring @snapshot-labs/tune's UiLoading (the sx-monorepo
 *  spinner): a rotating comet — a gradient-stroked circle + a solid leading arc.
 *  Uses currentColor so the caller sets the colour via a text-* class. */

withDefaults(defineProps<{ size?: number }>(), { size: 20 });
const gid = `metro-spin-${Math.random().toString(36).slice(2, 8)}`;
</script>

<template>
  <span class="metro-spinner inline-block align-middle leading-none">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
      class="block"
    >
      <defs>
        <linearGradient :id="gid" x1="28.154%" y1="63.74%" x2="74.629%" y2="17.783%">
          <stop stop-color="currentColor" offset="0%" />
          <stop stop-color="currentColor" stop-opacity="0" offset="100%" />
        </linearGradient>
      </defs>
      <g transform="translate(2)" fill="none" fill-rule="evenodd">
        <circle :stroke="`url(#${gid})`" stroke-width="4" cx="10" cy="12" r="10" />
        <path d="M10 2C4.477 2 0 6.477 0 12" stroke="currentColor" stroke-width="4" />
        <rect x="8" width="4" height="4" rx="8" fill="currentColor" />
      </g>
    </svg>
  </span>
</template>

<style scoped>
.metro-spinner svg { animation: metro-spin-rot 0.5s linear infinite; transform-origin: center; }
@keyframes metro-spin-rot { to { transform: rotate(360deg); } }
</style>
