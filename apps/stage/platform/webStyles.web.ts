const STYLE_ID = 'stage-web-global-styles';

const WEB_GLOBAL_CSS = [
  '* {',
  '  user-select: text !important;',
  '  -webkit-user-select: text !important;',
  '}',
  'input, textarea, [contenteditable] {',
  '  outline: none !important;',
  '}',
].join('\n');

export function applyWebGlobalStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = WEB_GLOBAL_CSS;
  document.head.appendChild(style);
}
