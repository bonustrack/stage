import { Pressable, Text as RNText, type ViewStyle } from 'react-native';
import { styleList, triggerLabelStyle, triggerRowStyle } from '../control.styles';
import { FONT_SIZE } from '../tokens';
import { Icon, type HeroIconName } from './icon';

export interface ControlTriggerProps {
  name?: string;
  disabled?: boolean;
  block?: boolean;
  clearable?: boolean;
  open: boolean;
  hasValue: boolean;
  label: string;
  icon: HeroIconName;
  box: ViewStyle;
  headColor: string;
  placeholderColor: string;
  style?: ViewStyle | ViewStyle[];
  onOpen: () => void;
  onClear: () => void;
}

export function ControlTrigger(props: ControlTriggerProps): React.ReactElement {
  const { name, disabled, block, clearable, open, hasValue, label, icon, box, headColor, placeholderColor, style, onOpen, onClear } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ disabled, expanded: open }}
      disabled={disabled}
      onPress={onOpen}
      style={[box, triggerRowStyle(block, disabled), ...styleList(style)]}
    >
      <RNText numberOfLines={1} style={triggerLabelStyle(hasValue ? headColor : placeholderColor, FONT_SIZE.md)}>
        {label}
      </RNText>
      {clearable && hasValue ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear" onPress={onClear} hitSlop={8}>
          <Icon name="x" size={16} color={placeholderColor} />
        </Pressable>
      ) : null}
      <Icon name={icon} size={16} color={placeholderColor} />
    </Pressable>
  );
}
