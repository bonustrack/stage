<script setup lang="ts">
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';
import { useKitScheme } from './theme-context';

const props = withDefaults(
  defineProps<{
    value: string;
    streaming?: boolean;
    color?: string;
    linkColor?: string;
    dark?: boolean;
  }>(),
  {},
);

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');

const fg = computed(() => props.color ?? (isDark.value ? '#ffffff' : '#000000'));
const link = computed(() => props.linkColor ?? '#2cc6c6');
const codeBg = computed(() => (isDark.value ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'));

const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false });

const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (token) {
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer nofollow');
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

const html = computed(() => md.render(props.value));

const rootStyle = computed<Record<string, string>>(() => ({
  color: fg.value,
  fontSize: '15px',
  lineHeight: '23px',
  fontFamily: 'Calibre-Medium',
}));

const vars = computed<Record<string, string>>(() => ({
  '--kit-md-fg': fg.value,
  '--kit-md-link': link.value,
  '--kit-md-code-bg': codeBg.value,
}));
</script>

<template>
  <div class="kit-md" :style="{ ...rootStyle, ...vars }" v-html="html" />
</template>

<style scoped>
.kit-md :deep(p) {
  margin-top: 0;
  margin-bottom: 6px;
}
.kit-md :deep(h1),
.kit-md :deep(h2),
.kit-md :deep(h3),
.kit-md :deep(h4),
.kit-md :deep(h5),
.kit-md :deep(h6) {
  color: var(--kit-md-fg);
  font-family: 'Calibre-Semibold';
  margin-top: 8px;
  margin-bottom: 3px;
}
.kit-md :deep(h1) {
  font-size: 24px;
  line-height: 28px;
}
.kit-md :deep(h2) {
  font-size: 21px;
  line-height: 25px;
}
.kit-md :deep(h3) {
  font-size: 19px;
  line-height: 23px;
}
.kit-md :deep(h4),
.kit-md :deep(h5),
.kit-md :deep(h6) {
  font-size: 18px;
  line-height: 22px;
}
.kit-md :deep(strong) {
  font-family: 'Calibre-Semibold';
  font-weight: normal;
}
.kit-md :deep(em) {
  font-style: italic;
}
.kit-md :deep(a) {
  color: var(--kit-md-link);
  text-decoration: underline;
}
.kit-md :deep(code) {
  background-color: var(--kit-md-code-bg);
  padding: 0 4px;
  border-radius: 4px;
  font-family: 'Menlo';
  font-size: 13px;
}
.kit-md :deep(pre) {
  background-color: var(--kit-md-code-bg);
  padding: 8px;
  border-radius: 6px;
  font-family: 'Menlo';
  font-size: 13px;
  line-height: 19px;
  overflow-x: auto;
}
.kit-md :deep(pre code) {
  background-color: transparent;
  padding: 0;
}
.kit-md :deep(ul),
.kit-md :deep(ol) {
  margin-top: 2px;
  margin-bottom: 6px;
}
.kit-md :deep(blockquote) {
  border-left: 3px solid var(--kit-md-code-bg);
  padding-left: 8px;
  margin: 4px 0;
}
</style>
