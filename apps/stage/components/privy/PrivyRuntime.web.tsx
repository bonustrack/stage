import { useEffect, useRef } from 'react';
import { clearPendingPrivyLogin, privyHostFailed, registerPrivyController, writePendingPrivyLogin } from '../../lib/privyBridge';
import { PRIVY_APP_ID, PRIVY_CLIENT_ID, privyLinkedType, privyOAuthProvider } from '../../lib/privyConfig';
import { privyOAuthRedirectUrl, restorePrivyOAuthReturn, returnedOAuthProvider, runsInDesktopShell } from '../../lib/privyReturn.web';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { installCredentiallessFrames } from '../../lib/credentiallessFrames.web';
import { PRIVY_RUNTIME_URL, publishedPrivyRuntime, type PrivyRuntimeHost, type PrivyStandalone } from './runtimeHost';

const FONT_STYLE_ID = 'stage-privy-font';
const FONT_RULE = "#privy-dialog, #privy-dialog * { font-family: 'Calibre-Medium', system-ui, sans-serif !important; }";
const LOAD_FAILED = 'Sign-in could not load. Check your connection and try again.';

function installPrivyFont(): void {
  if (document.getElementById(FONT_STYLE_ID) !== null) return;
  const style = document.createElement('style');
  style.id = FONT_STYLE_ID;
  style.textContent = FONT_RULE;
  document.head.appendChild(style);
}

function loadStandalone(): Promise<PrivyStandalone> {
  const ready = publishedPrivyRuntime();
  if (ready !== undefined) return Promise.resolve(ready);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = PRIVY_RUNTIME_URL;
    script.onload = () => {
      const runtime = publishedPrivyRuntime();
      if (runtime === undefined) reject(new Error(LOAD_FAILED));
      else resolve(runtime);
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(LOAD_FAILED));
    };
    document.head.appendChild(script);
  });
}

function hostFor(appId: string, dark: boolean, accent: string): PrivyRuntimeHost {
  return {
    appId,
    clientId: PRIVY_CLIENT_ID,
    dark,
    ...(/^#[0-9a-fA-F]{6}$/.test(accent) ? { accent: accent as `#${string}` } : {}),
    desktop: runsInDesktopShell(),
    oauthRedirectUrl: privyOAuthRedirectUrl(),
    returned: returnedOAuthProvider() !== null,
    oauthProvider: privyOAuthProvider,
    linkedType: privyLinkedType,
    pending: { write: writePendingPrivyLogin, clear: clearPendingPrivyLogin },
    register: registerPrivyController,
    failed: privyHostFailed,
  };
}

export function PrivyRuntime(): null {
  const dark = useEffectiveColorScheme() === 'dark';
  const { link } = usePalette();
  const started = useRef(false);
  useEffect(() => {
    if (started.current || PRIVY_APP_ID === undefined) return;
    started.current = true;
    installCredentiallessFrames();
    installPrivyFont();
    restorePrivyOAuthReturn();
    const host = hostFor(PRIVY_APP_ID, dark, link);
    void loadStandalone()
      .then((runtime) => {
        runtime.mount(host);
      })
      .catch((err: unknown) => {
        privyHostFailed(err instanceof Error ? err : new Error(LOAD_FAILED));
      });
  }, [dark, link]);
  return null;
}
