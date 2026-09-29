
import { useSafeAreaInsets } from '../../lib/safeArea';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import { ScreenHeader } from '../chrome/ScreenHeader';

export function WalletHeader({ title }: { title: string }): React.ReactElement {
  const { text: fg, link: head, border, toolbarBg } = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <ScreenHeader
      title={title}
      titleStyle={{
        kind: 'text',
        size: 'xl',
        weight: 'semibold',
        color: head,
      }}
      onBack={() => {
        capabilities.back();
      }}
      backColor={fg}
      safeTop={insets.top}
      surface={toolbarBg}
      borderColor={border}
    />
  );
}
