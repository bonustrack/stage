import { useState, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { colors, schemePalette } from '../tokens';
import { Icon, type HeroIconName } from './icon';
import { Text } from './text';

export interface PopoverItemView {
  id: string;
  label: string;
  icon?: HeroIconName;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export interface PopoverProps {
  trigger: ReactNode;
  items: PopoverItemView[];
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
  dark?: boolean;
}

export function Popover(props: PopoverProps): React.ReactElement {
  const { trigger, items, side = 'bottom', align = 'end', dark = false } = props;
  const [open, setOpen] = useState(false);
  const p = schemePalette(dark);
  const panelBg = dark ? colors['surface-dark'] : colors['bg-light'];
  const hoverBg = dark ? colors['hover-dark'] : colors['hover-light'];
  const danger = '#ef4444';
  const close = (): void => {
    setOpen(false);
  };
  const run = (item: PopoverItemView): void => {
    setOpen(false);
    item.onPress();
  };
  const vertical = side === 'top' ? { bottom: 52 } : { top: 52 };
  const horizontal = align === 'start' ? { left: 8 } : { right: 8 };
  return (
    <View>
      <Pressable
        onPress={() => {
          setOpen(true);
        }}
      >
        {trigger}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={{ flex: 1 }} onPress={close}>
          <Pressable
            onPress={() => undefined}
            style={{
              position: 'absolute',
              ...vertical,
              ...horizontal,
              minWidth: 200,
              paddingVertical: 4,
              borderRadius: 12,
              backgroundColor: panelBg,
              borderWidth: 1,
              borderColor: p.border,
              shadowColor: '#000000',
              shadowOpacity: 0.18,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 8,
            }}
          >
            {items.map((item) => (
              <Pressable
                key={item.id}
                disabled={item.disabled}
                onPress={() => {
                  run(item);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  opacity: item.disabled === true ? 0.5 : 1,
                  backgroundColor: pressed ? hoverBg : 'transparent',
                })}
              >
                {item.icon === undefined ? null : (
                  <Icon
                    name={item.icon}
                    size={20}
                    color={item.danger === true ? danger : p.sub}
                  />
                )}
                <Text size="sm" color={item.danger === true ? danger : p.head}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
