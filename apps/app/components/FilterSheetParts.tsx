/** FilterSheet building blocks — Section / ChipRow / Chip / StationChip / inputStyle. */

import { Pressable, Text, View } from 'react-native';
import { StationIcon } from './StationIcon';
import { stationLabel } from '../../_shared/icons/stations';

export function Section({
  label, colors, children,
}: {
  label: string;
  colors: { sub: string };
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.sub, textTransform: 'uppercase' }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }): React.ReactElement {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

export function Chip({
  label, on, onPress, colors,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  colors: { chipBg: string; chipBgOn: string; chipFg: string; chipFgOn: string; border: string };
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: on ? colors.chipBgOn : colors.chipBg,
        borderWidth: 1,
        borderColor: on ? colors.chipBgOn : colors.border,
      }}
    >
      <Text style={{ color: on ? colors.chipFgOn : colors.chipFg, fontSize: 13, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Station chip = colored icon + label. Used by the FilterSheet station picker. */
export function StationChip({
  station, on, onPress, colors,
}: {
  station: string;
  on: boolean;
  onPress: () => void;
  colors: { chipBg: string; chipBgOn: string; chipFg: string; chipFgOn: string; border: string };
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: on ? colors.chipBgOn : colors.chipBg,
        borderWidth: 1,
        borderColor: on ? colors.chipBgOn : colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <StationIcon station={station} />
      <Text style={{ color: on ? colors.chipFgOn : colors.chipFg, fontSize: 13, fontWeight: '600' }}>
        {stationLabel(station)}
      </Text>
    </Pressable>
  );
}

export function inputStyle(colors: {
  inputBg: string; fg: string; border: string;
}): {
  backgroundColor: string;
  color: string;
  borderRadius: number;
  paddingHorizontal: number;
  paddingVertical: number;
  borderWidth: number;
  borderColor: string;
  fontSize: number;
} {
  return {
    backgroundColor: colors.inputBg,
    color: colors.fg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
  };
}
