import type { ReactNode } from 'react';
import { Platform, type LayoutChangeEvent } from 'react-native';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { DROPDOWN_MENU, DropdownMenuItem, DropdownMenuSeparator, useDropdownMenuText } from '@stage-labs/kit/react-native/menu';
import { List } from '@stage-labs/kit/react-native/list';
import { SEARCH_INPUT_PROPS } from '@stage-labs/kit/react-native/text-field';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';
import { IconMagnifyingGlass } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMagnifyingGlass';
import { CountTag } from './CountTag';
import { FormField } from './FormField';
import { useAnchoredMenus } from './AnchoredMenu';
import { usePalette } from '../lib/theme';
import { Column, Row } from './layout';

const PICKER_LIST_MAX_HEIGHT = 320;
const PICKER_ROW_MIN_HEIGHT = 40;
const FIXED_ROW_PADDING = { paddingVertical: DROPDOWN_MENU.itemPadY };

export function PickerSearch({
  value,
  onChangeText,
  placeholder,
  onSubmit,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onSubmit?: () => void;
}): React.ReactElement {
  const { sub } = usePalette();
  const anchored = useAnchoredMenus();
  return (
    <>
      <FormField
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoFocus={anchored}
        onSubmit={onSubmit}
        leading={<Glyph icon={IconMagnifyingGlass} size={18} color={sub} />}
        inputProps={{ ...SEARCH_INPUT_PROPS, autoCapitalize: 'none', autoCorrect: false, returnKeyType: 'done' }}
      />
      <DropdownMenuSeparator />
    </>
  );
}

export function PickerList({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <List style={{ maxHeight: PICKER_LIST_MAX_HEIGHT }} keyboardShouldPersistTaps="handled">
      {children}
    </List>
  );
}

export function PickerNote({ text }: { text: string }): React.ReactElement {
  return (
    <Column padding={{ x: DROPDOWN_MENU.itemPadX, y: 10 }}>
      <Text size="xs" color="secondary">
        {text}
      </Text>
    </Column>
  );
}

function checkboxKeys(onPress: () => void, disabled: boolean) {
  if (Platform.OS !== 'web') return {};
  return {
    onKeyDown: (event: Pick<KeyboardEvent, 'key' | 'repeat' | 'preventDefault'>): void => {
      if (disabled || (event.key !== ' ' && event.key !== 'Spacebar')) return;
      event.preventDefault();
      if (!event.repeat) onPress();
    },
  };
}

function focusPickerRow(event: LayoutChangeEvent): void {
  const target: unknown = 'target' in event.nativeEvent ? event.nativeEvent.target : null;
  if (Platform.OS !== 'web' || typeof target !== 'object' || target === null) return;
  const node = target as { focus?: () => void };
  if (typeof node.focus === 'function') node.focus();
}

export function PickerRow({
  selected,
  disabled = false,
  label,
  text = label,
  count,
  onPress,
  leading,
  children,
  role = 'checkbox',
  autoFocus,
}: {
  selected: boolean;
  disabled?: boolean;
  label: string;
  text?: string;
  count?: number;
  onPress: () => void;
  leading?: ReactNode;
  children?: ReactNode;
  role?: 'checkbox' | 'radio';
  autoFocus?: boolean;
}): React.ReactElement {
  const { link } = usePalette();
  const menuText = useDropdownMenuText();
  return (
    <DropdownMenuItem
      label={count === undefined ? label : `${label} (${count})`}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      onLayout={autoFocus === true ? focusPickerRow : undefined}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      aria-disabled={disabled}
      {...checkboxKeys(onPress, disabled)}
      minHeight={PICKER_ROW_MIN_HEIGHT}
      style={FIXED_ROW_PADDING}
      leading={leading}
      trailing={selected ? <Glyph icon={IconCheckmark1} size={DROPDOWN_MENU.icon} color={link} /> : <Column width={DROPDOWN_MENU.icon} />}
    >
      <Column style={{ minWidth: 0 }}>
        {children ?? (
          <Row align="center" gap={DROPDOWN_MENU.itemGap}>
            <Column style={{ flexShrink: 1, minWidth: 0 }}>
              <Text {...menuText} truncate>
                {text}
              </Text>
            </Column>
            {count === undefined ? null : <CountTag count={count} />}
          </Row>
        )}
      </Column>
    </DropdownMenuItem>
  );
}
