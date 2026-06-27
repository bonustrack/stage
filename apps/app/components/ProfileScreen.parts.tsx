
import { useEffect, useState } from 'react';
import { Row } from './layout';
import { usePalette, type Palette } from '../lib/theme';
import { getCachedXmtpClient, getOrCreateXmtpClient } from '../modules/messaging';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { WidgetActionRegistry, WidgetRoot } from '@stage-labs/kit/kit';
import {
  basicRoot, profileActionsRow, screenHeader,
  PROFILE_ROUND_PRESS, SCREEN_BACK,
} from '@stage-labs/views';
import { TopnavIdentity } from './TopnavIdentity';

export type ProfileColors = Palette;

export function useProfileColors(): ProfileColors {
  return usePalette();
}

export function useSelfAddress(): string {
  const cached = getCachedXmtpClient();
  const [self, setSelf] = useState(cached?.publicIdentity.identifier ?? '');
  useEffect(() => {
    if (self) return;
    let alive = true;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        if (alive) setSelf(client.publicIdentity.identifier);
      } catch { }
    })();
    return () => { alive = false; };
  }, [self]);
  return self;
}

export function ProfileHeader({ variant, insetTop, onBack, c }: {
  variant: 'tab' | 'route'; insetTop: number;
  onBack: () => void; c: ProfileColors;
}): React.ReactElement {
  if (variant === 'route') {
    const node = basicRoot(screenHeader({
      variant: 'overlay',
      backColor: c.link,
      backHitSlop: 10,
      backPadding: 6,
      safeTop: insetTop,
    }));
    const registry: WidgetActionRegistry = { [SCREEN_BACK]: () => { onBack(); } };
    return <KitRenderer node={node} registry={registry} />;
  }
  return (
    <Row
      align="center"
      justify="between"
      height={44 + insetTop}
      padding={{ top: insetTop, x: 14 }}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }}
>
      <TopnavIdentity/>
    </Row>
  );
}

export function ProfileActions({ opening, onMessage, onSend, c }: {
  dark: boolean; opening: boolean; onMessage: () => void; onSend: () => void; c: ProfileColors;
}): React.ReactElement {
  const node: WidgetRoot = {
    type: 'Basic',
    children: [
      profileActionsRow({
        border: c.border,
        fg: c.link,
        actions: [
          { action: 'message', icon: 'chatRect', label: opening ? 'Opening…' : 'Message', disabled: opening },
          { action: 'send', icon: 'send', label: 'Send' },
        ],
      }),
    ],
  };
  const registry: WidgetActionRegistry = {
    [PROFILE_ROUND_PRESS]: (a) => {
      if (a.payload.action === 'message') { if (!opening) onMessage(); }
      else if (a.payload.action === 'send') onSend();
    },
  };
  return <KitRenderer node={node} registry={registry} />;
}
