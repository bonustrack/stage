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
  'html.stage-resizing * {',
  '  user-select: none !important;',
  '  -webkit-user-select: none !important;',
  '}',
  '@keyframes stage-spin {',
  '  to { transform: rotate(360deg); }',
  '}',
  '[data-stagemenurow="1"]:hover {',
  '  background-color: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.06));',
  '}',
  '[data-stagemenurow="1"]:hover * {',
  '  color: light-dark(#000000, #ffffff) !important;',
  '}',
  '[data-stagedrag="1"] {',
  '  -webkit-app-region: drag;',
  '}',
  '[data-stagespin="1"] {',
  '  animation: stage-spin 0.5s linear infinite;',
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
