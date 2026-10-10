import type { ReactNode } from 'react';
import { GesturePressable } from '@stage-labs/kit/react-native/gesture-pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { Title } from '@stage-labs/kit/react-native/title';
import { resolveColorToken } from '@stage-labs/kit/tokens';
import { Row, STICKY_TOP, PAGE_GUTTER } from '../layout';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import { HoverTint } from '../hover';
import { TOPNAV_HEIGHT } from '../Topnav';
import { IconArrowLeft } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowLeft';

const BACK_PAD = { padding: 4 } as const;
const TITLE_SHRINK = { flexShrink: 1 } as const;

function BackButton({ onBack, backColor }: {
  onBack: () => void;
  backColor: string;
}): React.ReactElement {
  const scheme = useKitScheme();
  const { link } = usePalette();
  return (
    <GesturePressable onPress={onBack} hitSlop={8}>
      <HoverTint style={BACK_PAD}>
        {(hovered) => (
          <Glyph
            icon={IconArrowLeft}
            size={24}
            color={hovered ? link : resolveColorToken(backColor, scheme)}
            dark={scheme === 'dark'}
          />
        )}
      </HoverTint>
    </GesturePressable>
  );
}

function HeaderTitle({ title, wallet, color }: { title: string; wallet: boolean; color: string }): React.ReactElement | null {
  if (title === '') return null;
  if (wallet) return <Text value={title} size="sm" weight="semibold" color={color} />;
  return <Title size="sm" color={color} style={TITLE_SHRINK}>{title}</Title>;
}

export function StackHeader({ title, trailing, backTo, onBack, inline, bordered = true, wallet = false }: {
  title: string;
  trailing?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  inline?: boolean;
  bordered?: boolean;
  wallet?: boolean;
}): React.ReactElement {
  const scheme = useKitScheme();
  const { text: fg, link: head, border, toolbarBg: surface } = usePalette();
  const safeTop = useSafeAreaInsets().top;
  const top = inline === true ? 0 : safeTop;
  return (
      <Row
        align="center"
        justify={title === '' ? 'between' : undefined}
        gap={8}
        minHeight={wallet ? undefined : TOPNAV_HEIGHT + top}
        background={surface}
        border={bordered ? { bottom: { width: 1, color: resolveColorToken(border, scheme) } } : undefined}
        style={STICKY_TOP}
        padding={{ x: PAGE_GUTTER, top: (wallet ? 8 : 0) + top, bottom: wallet ? 10 : 0 }}
      >
        <BackButton
          onBack={onBack ?? (() => {
            if (backTo === undefined) capabilities.back();
            else capabilities.backTo(backTo);
          })}
          backColor={fg}
        />
        <HeaderTitle title={title} wallet={wallet} color={head} />
        {trailing}
      </Row>
  );
}
