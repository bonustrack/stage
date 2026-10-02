import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { HoverTooltip } from '../HoverTooltip';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';

const SIZES = { sm: { button: 'sm', glyph: 16 }, xl: { button: 'xl', glyph: 22 } } as const;

export function CallControl({ icon, label, active, danger, size = 'xl', onPress }: {
  icon: CentralIcon; label: string; active: boolean; danger?: boolean; size?: keyof typeof SIZES; onPress: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { link, bg, danger: red } = usePalette();
  const fg = danger === true || active ? bg : link;
  const spec = SIZES[size];
  return (
    <HoverTooltip label={label} placement="above">
      <Button
        size={spec.button} uniform pill dark={dark} accessibilityLabel={label} aria-pressed={active}
        color="secondary" variant={active || danger === true ? 'solid' : 'soft'}
        tintBg={danger === true ? red : active ? link : undefined}
        icon={<Glyph icon={icon} size={spec.glyph} color={fg}/>} onPress={onPress}
      />
    </HoverTooltip>
  );
}
