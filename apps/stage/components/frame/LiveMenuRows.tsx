import { IconArrowRotateClockwise } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowRotateClockwise';
import { IconBento } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconBento';
import { IconSquareBehindSquare1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquareBehindSquare1';
import { MenuRow } from '../MenuRows';
import { capabilities } from '../../lib/capabilities';

export function LiveMenuRows({ url, onRefresh, onAddToDashboard, onClose }: {
  url: string; onRefresh: () => void; onAddToDashboard?: () => void; onClose: () => void;
}): React.ReactElement {
  return (
    <>
      <MenuRow icon={IconArrowRotateClockwise} label="Refresh" onPress={() => { onClose(); onRefresh(); }} />
      <MenuRow icon={IconSquareBehindSquare1} label="Copy link" onPress={() => { onClose(); capabilities.copy('Link', url); }} />
      {onAddToDashboard === undefined ? null : (
        <MenuRow icon={IconBento} label="Add to dashboard" onPress={() => { onClose(); onAddToDashboard(); }} />
      )}
    </>
  );
}
