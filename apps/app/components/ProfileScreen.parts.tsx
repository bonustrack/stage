
import { useEffect, useState } from 'react';
import { Row } from './layout';
import { usePalette, type Palette } from '../lib/theme';
import { getCachedXmtpClient, getOrCreateXmtpClient } from '../modules/messaging';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers } from '@stage-labs/kit/kit';
import {
  backAction, profileMessageSendNode, profileOverlayHeaderNode,
  PROFILE_ROUND_PRESS,
} from '@stage-labs/views';
import { capabilities } from '../lib/capabilities';
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

export function ProfileHeader({ variant, insetTop, c }: {
  variant: 'tab' | 'route'; insetTop: number;
  c: ProfileColors;
}): React.ReactElement {
  if (variant === 'route') {
    const node = profileOverlayHeaderNode(c.link, insetTop);
    const actions: PayloadHandlers = { ...backAction(capabilities) };
    return <ViewHost node={node} actions={actions} />;
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
  const node = profileMessageSendNode({ border: c.border, fg: c.link }, opening);
  const actions: PayloadHandlers = {
    [PROFILE_ROUND_PRESS]: (payload) => {
      if (payload.action === 'message') { if (!opening) onMessage(); }
      else if (payload.action === 'send') onSend();
    },
  };
  return <ViewHost node={node} actions={actions} />;
}
