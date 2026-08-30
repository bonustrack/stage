const STYLE_ID = 'stage-web-global-styles';

const WEB_GLOBAL_CSS = [
  '* {',
  '  user-select: text !important;',
  '  -webkit-user-select: text !important;',
  '}',
  'input, textarea, [contenteditable] {',
  '  outline: none !important;',
  '}',
  'html.stage-resizing * {',
  '  user-select: none !important;',
  '  -webkit-user-select: none !important;',
  '}',
  ':root {',
  '  --stage-gutter: var(--stage-sbw, 0px);',
  '}',
  '@keyframes stage-spin {',
  '  to { transform: rotate(360deg); }',
  '}',
  '[data-stagespin="1"] {',
  '  animation: stage-spin 0.5s linear infinite;',
  '}',
  '@media (pointer: fine) {',
  '  :root {',
  '    --stage-gutter: max(var(--stage-sbw, 0px), 12px);',
  '    scrollbar-color: rgba(128, 128, 128, 0.45) transparent;',
  '  }',
  '  ::-webkit-scrollbar {',
  '    width: 12px;',
  '  }',
  '  ::-webkit-scrollbar:horizontal {',
  '    display: none;',
  '  }',
  '  ::-webkit-scrollbar-track {',
  '    background: transparent;',
  '  }',
  '  ::-webkit-scrollbar-thumb {',
  '    background-color: rgba(128, 128, 128, 0.45);',
  '    background-clip: content-box;',
  '    border: 3px solid transparent;',
  '    border-radius: 999px;',
  '  }',
  '  ::-webkit-scrollbar-thumb:hover {',
  '    background-color: rgba(128, 128, 128, 0.7);',
  '  }',
  '}',
].join('\n');

function measuredScrollbarWidth(): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;';
  document.body.appendChild(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return width;
}

export function applyWebGlobalStyles(): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(STYLE_ID);
  const style = existing ?? document.createElement('style');
  if (!existing) {
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = WEB_GLOBAL_CSS;
  document.documentElement.style.setProperty('--stage-sbw', `${measuredScrollbarWidth()}px`);
}
