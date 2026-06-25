
import { Pressable, View } from 'react-native';
import { Icon } from './icon';

export interface ColorPickerProps {
  value: string;
  swatches?: string[];
  onChange?: (value: string) => void;
  dark?: boolean;
}

export const DEFAULT_SWATCHES = [
  '#000000',
  '#ffffff',
  '#eb4c5b',
  '#e07a0c',
  '#e0a106',
  '#1f9d57',
  '#2f6df6',
  '#8b5cf6',
];

function readable(hex: string): string {
  const group = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1];
  if (group === undefined) return '#ffffff';
  const n = Number.parseInt(group, 16);
  const lum = (0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)) / 255;
  return lum > 0.6 ? '#000000' : '#ffffff';
}

export function ColorPicker(props: ColorPickerProps): React.ReactElement {
  const { value, swatches = DEFAULT_SWATCHES, onChange, dark = false } = props;
  const border = dark ? '#3a3c40' : '#d8d8da';
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {swatches.map((hex) => {
        const selected = hex.toLowerCase() === value.toLowerCase();
        return (
          <Pressable
            key={hex}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange?.(hex)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: hex,
              borderWidth: 1,
              borderColor: border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {selected ? <Icon name="check" size={18} color={readable(hex)} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
