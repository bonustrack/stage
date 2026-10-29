import { useState } from 'react';
import { Pressable, Text as RNText, View, type ViewStyle } from 'react-native';
import type { ValidationResult } from '../a2ui/protocol';
import { styleList } from '../control.styles';
import { FONT_SIZE, fontName } from '../tokens';
import { accessibilityProps, type A2uiCommonProps } from './a2ui-props';
import { CheckboxBox, checkboxColors } from './check-box';
import { WithChecks } from './control-trigger';
import { TextField } from './text-field';
import { useKitScheme } from './theme-context';
import { loadKitFonts } from './fonts.load';

loadKitFonts();

export interface ChoiceOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export type ChoicePickerVariant = 'mutuallyExclusive' | 'multipleSelection';

export type ChoicePickerDisplayStyle = 'checkbox' | 'chips';

export interface ChoicePickerProps extends A2uiCommonProps {
  options: readonly ChoiceOption[];
  value?: readonly string[];
  defaultValue?: readonly string[];
  onChange?: (value: string[]) => void;
  label?: string;
  variant?: ChoicePickerVariant;
  displayStyle?: ChoicePickerDisplayStyle;
  filterable?: boolean;
  checks?: readonly ValidationResult[];
  disabled?: boolean;
  dark?: boolean;
  direction?: 'row' | 'col';
  style?: ViewStyle | ViewStyle[];
}

const SIZE = 20;

type Palette = ReturnType<typeof checkboxColors>;

interface OptionViewProps {
  option: ChoiceOption;
  selected: boolean;
  disabled: boolean;
  palette: Palette;
  onPick: (value: string) => void;
}

function RadioMark({ selected, palette }: { selected: boolean; palette: Palette }): React.ReactElement {
  const outer: ViewStyle = {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    borderColor: selected ? palette.head : palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <View style={outer}>
      {selected ? (
        <View style={{ width: SIZE * 0.5, height: SIZE * 0.5, borderRadius: SIZE * 0.25, backgroundColor: palette.head }} />
      ) : null}
    </View>
  );
}

function OptionRow({ option, selected, disabled, palette, onPick, multiple }: OptionViewProps & { multiple: boolean }): React.ReactElement {
  return (
    <Pressable
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={multiple ? { checked: selected, disabled } : { selected, disabled }}
      accessibilityLabel={option.label}
      disabled={disabled}
      onPress={() => {
        onPick(option.value);
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: disabled ? 0.5 : 1 }}
    >
      {multiple ? <CheckboxBox size={SIZE} checked={selected} colors={palette} /> : <RadioMark selected={selected} palette={palette} />}
      <RNText style={{ color: palette.head, fontSize: FONT_SIZE.xs, fontFamily: fontName.sans }}>{option.label}</RNText>
    </Pressable>
  );
}

function Chip({ option, selected, disabled, palette, onPick }: OptionViewProps): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={option.label}
      disabled={disabled}
      onPress={() => {
        onPick(option.value);
      }}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? palette.head : palette.border,
        backgroundColor: selected ? palette.head : 'transparent',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <RNText style={{ color: selected ? palette.bg : palette.head, fontSize: FONT_SIZE['2xs'], fontFamily: fontName.sans }}>
        {option.label}
      </RNText>
    </Pressable>
  );
}

function nextSelection(current: readonly string[], value: string, multiple: boolean): string[] {
  if (!multiple) return [value];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

function filterOptions(options: readonly ChoiceOption[], query: string): readonly ChoiceOption[] {
  const needle = query.trim().toLowerCase();
  return needle === '' ? options : options.filter((o) => o.label.toLowerCase().includes(needle));
}

function useSelection(props: ChoicePickerProps): [readonly string[], (value: string) => void] {
  const [internal, setInternal] = useState<readonly string[]>(props.defaultValue ?? []);
  const selected = props.value ?? internal;
  return [
    selected,
    (value) => {
      const next = nextSelection(selected, value, props.variant === 'multipleSelection');
      if (props.value === undefined) setInternal(next);
      props.onChange?.(next);
    },
  ];
}

function containerStyle(chips: boolean, direction: 'row' | 'col'): ViewStyle {
  if (chips) return { flexDirection: 'row', flexWrap: 'wrap', gap: 8 };
  return { flexDirection: direction === 'row' ? 'row' : 'column', gap: 12 };
}

export function ChoicePicker(props: ChoicePickerProps): React.ReactElement {
  const {
    options,
    label,
    displayStyle = 'checkbox',
    filterable,
    checks,
    disabled = false,
    direction = 'col',
    style,
    weight,
    accessibility,
  } = props;
  const scheme = useKitScheme();
  const dark = props.dark ?? scheme === 'dark';
  const palette = checkboxColors(dark);
  const [query, setQuery] = useState('');
  const [selected, pick] = useSelection(props);
  const chips = displayStyle === 'chips';
  const multiple = props.variant === 'multipleSelection';
  const shown = filterable === true ? filterOptions(options, query) : options;
  return (
    <WithChecks checks={checks} weight={weight}>
      {(rootStyle) => (
        <View
          accessibilityRole={multiple ? undefined : 'radiogroup'}
          {...accessibilityProps(accessibility)}
          style={[{ gap: 10 }, ...styleList(style), ...styleList(rootStyle)]}
        >
          {label === undefined ? null : (
            <RNText style={{ color: palette.head, fontSize: FONT_SIZE.xs, fontFamily: fontName.head }}>{label}</RNText>
          )}
          {filterable === true ? (
            <TextField value={query} onChangeText={setQuery} placeholder="Filter options" dark={dark} disabled={disabled} />
          ) : null}
          <View style={containerStyle(chips, direction)}>
            {shown.map((option) => {
              const view: OptionViewProps = {
                option,
                selected: selected.includes(option.value),
                disabled: disabled || option.disabled === true,
                palette,
                onPick: pick,
              };
              return chips ? <Chip key={option.value} {...view} /> : <OptionRow key={option.value} {...view} multiple={multiple} />;
            })}
          </View>
        </View>
      )}
    </WithChecks>
  );
}
