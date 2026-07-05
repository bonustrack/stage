
import { Pressable, Text as RNText, View, type ViewStyle } from 'react-native';

export interface SwitchProps {
  name?: string;
  checked: boolean;
  disabled?: boolean;
  label?: string;
  onChange?: (checked: boolean) => void;
  dark?: boolean;
}

function track(checked: boolean, dark: boolean): ViewStyle {
  const on = dark ? '#ffffff' : '#000000';
  const off = dark ? '#3a3c40' : '#d8d8da';
  return {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: checked ? on : off,
    padding: 3,
    justifyContent: 'center',
  };
}

function knob(checked: boolean, dark: boolean): ViewStyle {
  return {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: checked && !dark ? '#ffffff' : checked ? '#000000' : '#ffffff',
    alignSelf: checked ? 'flex-end' : 'flex-start',
  };
}

export function Switch(props: SwitchProps): React.ReactElement {
  const { name, checked, disabled, label, onChange, dark = false } = props;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label ?? name}
      disabled={disabled}
      onPress={() => {
        if (!disabled) onChange?.(!checked);
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={track(checked, dark)}>
        <View style={knob(checked, dark)} />
      </View>
      {label ? (
        <RNText
          style={{
            color: dark ? '#ffffff' : '#000000',
            fontSize: 15,
            fontFamily: 'Calibre-Medium',
          }}
        >
          {label}
        </RNText>
      ) : null}
    </Pressable>
  );
}
