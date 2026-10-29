import { useState } from 'react';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { IconArrowRotateClockwise } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowRotateClockwise';
import { IconBento } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconBento';
import { IconSquareBehindSquare1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquareBehindSquare1';
import { AnchoredMenu } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { MenuRow } from '../MenuRows';
import { capabilities } from '../../lib/capabilities';
import { frameNodeOf } from './frame.model';
import { addChatFrameToDashboard } from './frameDashboard';
import { useDeveloperMode } from '../../lib/developerMode';

export function FrameMenuRows({
  url,
  onRefresh,
  onAddToDashboard,
  onClose,
}: {
  url?: string;
  onRefresh?: () => void;
  onAddToDashboard?: () => void;
  onClose: () => void;
}): React.ReactElement {
  const developerMode = useDeveloperMode();
  return (
    <>
      {onRefresh === undefined ? null : (
        <MenuRow
          icon={IconArrowRotateClockwise}
          label="Refresh"
          onPress={() => {
            onClose();
            onRefresh();
          }}
        />
      )}
      {url === undefined ? null : (
        <MenuRow
          icon={IconSquareBehindSquare1}
          label="Copy link"
          onPress={() => {
            onClose();
            capabilities.copy('Link', url);
          }}
        />
      )}
      {!developerMode || onAddToDashboard === undefined ? null : (
        <MenuRow
          icon={IconBento}
          label="Add to dashboard"
          onPress={() => {
            onClose();
            onAddToDashboard();
          }}
        />
      )}
    </>
  );
}

export function ChatFrameMenu({
  frame,
  convId,
  messageId,
  onRefresh,
  trigger,
}: {
  frame: FrameContent;
  convId: string;
  messageId: string;
  onRefresh?: () => void;
  trigger: (open: (anchor: MenuPoint) => void) => React.ReactElement;
}): React.ReactElement | null {
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const developerMode = useDeveloperMode();
  const node = frameNodeOf(frame);
  const close = (): void => {
    setAnchor(null);
  };
  if (!developerMode && node === null) return null;
  return (
    <>
      {trigger(setAnchor)}
      {anchor === null ? null : (
        <AnchoredMenu visible onClose={close} anchor={anchor}>
          <FrameMenuRows
            url={node?.url}
            onRefresh={node === null ? undefined : onRefresh}
            onClose={close}
            onAddToDashboard={() => {
              void addChatFrameToDashboard(convId, messageId, frame);
            }}
          />
        </AnchoredMenu>
      )}
    </>
  );
}
