
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import { TOPNAV_HEIGHT } from '../Topnav';
import { ScreenHeader } from './ScreenHeader';

export function StackHeader({ title, trailing, backTo, onBack, inline, bordered = true }: {
  title: string;
  trailing?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  inline?: boolean;
  bordered?: boolean;
}): React.ReactElement {
  const { text: fg, link: head, border, toolbarBg } = usePalette();
  const safeTop = useSafeAreaInsets().top;
  const top = inline === true ? 0 : safeTop;
  return (
    <ScreenHeader
      title={title}
      titleStyle={{ kind: 'title', size: 'sm', color: head }}
      onBack={onBack ?? (() => {
        if (backTo === undefined) capabilities.back();
        else capabilities.backTo(backTo);
      })}
      backColor={fg}
      safeTop={top}
      padTop={0}
      padBottom={0}
      minHeight={TOPNAV_HEIGHT + top}
      surface={toolbarBg}
      borderColor={bordered ? border : undefined}
      trailing={trailing}
    />
  );
}
