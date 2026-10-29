import type { ReactNode, Ref } from 'react';
import { Modal, Pressable, Text as RNText, View, type ViewStyle } from 'react-native';
import { styleList, triggerLabelStyle, triggerRowStyle } from '../control.styles';
import { FONT_SIZE } from '../tokens';
import { Glyph, type CentralIcon } from './glyph';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import type { ValidationResult } from '../a2ui/protocol';
import { firstCheckMessage, weightStyle } from './a2ui-props';
import { Text } from './text';

export function WithChecks({
  checks,
  weight,
  children,
}: {
  checks?: readonly ValidationResult[];
  weight?: number;
  children: (rootStyle: ViewStyle | undefined) => ReactNode;
}): React.ReactElement {
  const message = firstCheckMessage(checks);
  if (message === undefined) return <>{children(weightStyle(weight))}</>;
  return (
    <View style={weightStyle(weight)}>
      {children(undefined)}
      <Text text={message} size="2xs" color="danger" style={{ marginTop: 4 }} />
    </View>
  );
}

export interface ControlTriggerProps {
  name?: string;
  disabled?: boolean;
  block?: boolean;
  clearable?: boolean;
  open: boolean;
  hasValue: boolean;
  label: string;
  icon: CentralIcon;
  box: ViewStyle;
  rootStyle?: ViewStyle;
  headColor: string;
  placeholderColor: string;
  style?: ViewStyle | ViewStyle[];
  onOpen: () => void;
  onClear: () => void;
  triggerRef?: Ref<View>;
}

export function ControlSheet({
  open,
  onClose,
  panelStyle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  panelStyle: ViewStyle;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable style={panelStyle} onPress={() => undefined}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function ControlTrigger(props: ControlTriggerProps): React.ReactElement {
  const {
    name,
    disabled,
    block,
    clearable,
    open,
    hasValue,
    label,
    icon,
    box,
    rootStyle,
    headColor,
    placeholderColor,
    style,
    onOpen,
    onClear,
    triggerRef,
  } = props;
  return (
    <Pressable
      ref={triggerRef}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ disabled, expanded: open }}
      disabled={disabled}
      onPress={onOpen}
      style={[box, triggerRowStyle(block, disabled), ...styleList(style), ...styleList(rootStyle)]}
    >
      <RNText numberOfLines={1} style={triggerLabelStyle(hasValue ? headColor : placeholderColor, FONT_SIZE.xs)}>
        {label}
      </RNText>
      {clearable && hasValue ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear" onPress={onClear} hitSlop={8}>
          <Glyph icon={IconCrossMedium} size={16} color={placeholderColor} />
        </Pressable>
      ) : null}
      <Glyph icon={icon} size={16} color={placeholderColor} />
    </Pressable>
  );
}
