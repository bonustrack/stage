
(function () {
  var script = document.currentScript;
  var convId = script.getAttribute('data-conv-id') || '';
  var title = script.getAttribute('data-title') || 'Chat';
  var metroUrl = script.getAttribute('data-metro-url') || new URL(script.src).origin;
  if (!convId) {
    console.warn('[metro-embed] missing data-conv-id; widget will not mount');
    return;
  }

  var WIDGET_ID = 'metro-embed-widget';
  if (document.getElementById(WIDGET_ID)) return;

  var wrap = document.createElement('div');
  wrap.id = WIDGET_ID;
  wrap.style.cssText = [
    'position:fixed',
    'right:20px',
    'bottom:20px',
    'z-index:2147483646',
    'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
  ].join(';');

  var button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', title);
  button.style.cssText = [
    'width:56px', 'height:56px', 'border-radius:9999px',
    'background:#1a1f29', 'color:#fff', 'border:0', 'cursor:pointer',
    'box-shadow:0 8px 24px rgba(0,0,0,0.18)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'font-size:24px', 'line-height:1',
  ].join(';');
  button.textContent = '💬';

  var panel = document.createElement('div');
  panel.style.cssText = [
    'position:absolute', 'right:0', 'bottom:72px',
    'width:380px', 'height:580px',
    'max-width:calc(100vw - 40px)', 'max-height:calc(100vh - 100px)',
    'background:#fff', 'border-radius:16px', 'overflow:hidden',
    'box-shadow:0 16px 48px rgba(0,0,0,0.22)',
    'display:none', 'flex-direction:column',
  ].join(';');

  var iframe = document.createElement('iframe');
  iframe.title = title;
  iframe.style.cssText = 'flex:1;width:100%;border:0;display:block';
  iframe.allow = 'clipboard-write; geolocation; microphone; camera';
  iframe.dataset.src = metroUrl.replace(/\/$/, '') + '/#/embed/' + encodeURIComponent(convId);
  panel.appendChild(iframe);

  var open = false;
  function toggle() {
    open = !open;
    panel.style.display = open ? 'flex' : 'none';
    button.textContent = open ? '×' : '💬';
    button.style.fontSize = open ? '28px' : '24px';
    if (open && !iframe.src) iframe.src = iframe.dataset.src;
  }
  button.addEventListener('click', toggle);

  wrap.appendChild(panel);
  wrap.appendChild(button);
  (document.body || document.documentElement).appendChild(wrap);
})();
