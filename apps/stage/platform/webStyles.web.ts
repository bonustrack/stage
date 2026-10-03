const STYLE_ID = 'stage-web-global-styles';

const WEB_GLOBAL_CSS = [
  '* {',
  '  user-select: text !important;',
  '  -webkit-user-select: text !important;',
  '}',
  'input, textarea, [contenteditable] {',
  '  outline: none !important;',
  '}',
  'body {',
  '  -webkit-font-smoothing: antialiased;',
  '  -moz-osx-font-smoothing: grayscale;',
  '}',
  'html.stage-resizing *, html.stage-dragging * {',
  '  user-select: none !important;',
  '  -webkit-user-select: none !important;',
  '}',
  'html.stage-resizing * {',
  '  cursor: col-resize !important;',
  '}',
  '[data-stagemenurow="1"]:hover {',
  '  opacity: 0.8;',
  '}',
  '[data-stagedrag="1"] {',
  '  -webkit-app-region: drag;',
  '}',
  '[data-stagescrollbar="1"]::-webkit-scrollbar {',
  '  width: 16px;',
  '  height: 16px;',
  '}',
  '[data-stagescrollbar="1"]::-webkit-scrollbar-thumb, [data-stagescrollbar="1"]::-webkit-scrollbar-track {',
  '  background-clip: padding-box;',
  '  border: 4px solid transparent;',
  '  border-radius: 8px;',
  '}',
  '[data-stagescrollbar="1"]::-webkit-scrollbar-track {',
  '  background-color: transparent;',
  '}',
  '[data-stagescrollbar="1"]::-webkit-scrollbar-thumb {',
  '  background-color: var(--stage-scrollbar-thumb);',
  '  min-height: 40px;',
  '}',
  '[data-stagescrollbar="1"]::-webkit-scrollbar-corner {',
  '  background-color: transparent;',
  '}',
  '[data-stagescrollbarhover="1"]:not(:hover) [data-stagescrollbar="1"]::-webkit-scrollbar-thumb {',
  '  background-color: transparent;',
  '}',
  '@supports not selector(::-webkit-scrollbar) {',
  '  [data-stagescrollbar="1"] {',
  '    scrollbar-color: var(--stage-scrollbar-thumb) transparent;',
  '  }',
  '  [data-stagescrollbarhover="1"]:not(:hover) [data-stagescrollbar="1"] {',
  '    scrollbar-color: transparent transparent;',
  '  }',
  '}',
].join('\n');

export function applyWebGlobalStyles(): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(STYLE_ID);
  const style = existing ?? document.createElement('style');
  if (!existing) {
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = WEB_GLOBAL_CSS;
}
