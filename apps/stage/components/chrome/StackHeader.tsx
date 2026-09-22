
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import { TOPNAV_HEIGHT } from '../Topnav';
import { ScreenHeader } from './ScreenHeader';

export function StackHeader({ title, trailing, backTo }: {
  title: string;
  trailing?: ReactNode;
  backTo?: string;
}): React.ReactElement {
  const { text: fg, link: head, border, toolbarBg } = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <ScreenHeader
      title={title}
      titleStyle={{ kind: 'title', size: 'sm', color: head }}
      onBack={() => {
        if (backTo === undefined) capabilities.back();
        else capabilities.backTo(backTo);
      }}
      backColor={fg}
      safeTop={insets.top}
      padTop={0}
      padBottom={0}
      minHeight={TOPNAV_HEIGHT + insets.top}
      surface={toolbarBg}
      borderColor={border}
      trailing={trailing}
    />
  );
}
