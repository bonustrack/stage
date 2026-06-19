/** DatePicker - a ChatKit-styled date field. Mirrors ChatKit's `DatePicker`
 *  widget. Faithful prop names: `name`, `defaultValue` (YYYY-MM-DD), `placeholder`,
 *  `variant` ('soft' | 'outline'), `size` (ControlSize), `pill`, `block`,
 *  `clearable`, `disabled`, `min`, `max` (YYYY-MM-DD bounds). Deviations (kit is
 *  interactive RN, not server-streamed): ChatKit's `onChangeAction` (a server
 *  ActionConfig) is replaced by an `onChange(value)` callback, a controlled
 *  `value` prop is accepted, and ChatKit's popover `align`/`side` placement is
 *  expressed as a centred RN Modal sheet. `dark` boolean keeps the kit hook-free.
 *  Self-contained calendar grid (no native date dependency) drawn with kit
 *  tokens + the shared control box style. Values are ISO YYYY-MM-DD strings. */

import { useState } from 'react';
import {
  Modal,
  Pressable,
  Text as RNText,
  View,
  type ViewStyle,
} from 'react-native';
import {
  controlBoxStyle,
  controlColors,
  type ControlSize,
  type ControlVariant,
} from './control.styles';
import { BLOCK_RADIUS_DEFAULT } from './tokens';
import { Icon } from './icon';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Parse an ISO YYYY-MM-DD into a local Date (or null). */
function parseISO(v: string | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a Date as ISO YYYY-MM-DD (local). */
function toISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export interface DatePickerProps {
  /** ChatKit: name. Form field name (required). */
  name?: string;
  /** ChatKit: defaultValue. Initial date (YYYY-MM-DD, uncontrolled). */
  defaultValue?: string;
  /** Controlled value (YYYY-MM-DD; kit extension, pair with onChange). */
  value?: string;
  /** ChatKit: placeholder. Shown when no date is selected. */
  placeholder?: string;
  /** ChatKit: variant. 'soft' (filled) | 'outline'. Default 'soft'. */
  variant?: ControlVariant;
  /** ChatKit: size. ControlSize scale. Default 'md'. */
  size?: ControlSize;
  /** ChatKit: pill. Fully-rounded corners. */
  pill?: boolean;
  /** ChatKit: block. Stretch to the container width. */
  block?: boolean;
  /** ChatKit: clearable. Show a clear ('x') affordance when a date is set. */
  clearable?: boolean;
  /** ChatKit: disabled. */
  disabled?: boolean;
  /** ChatKit: min. Earliest selectable date (YYYY-MM-DD). */
  min?: string;
  /** ChatKit: max. Latest selectable date (YYYY-MM-DD). */
  max?: string;
  /** Corner radius (px). Falls back to the block radius token (or pill). */
  radius?: number;
  /** RN substitute for ChatKit's onChangeAction. */
  onChange?: (value: string) => void;
  /** Effective color scheme. Pass useEffectiveColorScheme() === 'dark'. */
  dark?: boolean;
  /** Escape-hatch style merged last onto the trigger box. */
  style?: ViewStyle | ViewStyle[];
}

/** ChatKit-style RN date picker. */
export function DatePicker(props: DatePickerProps): React.ReactElement {
  const {
    name,
    defaultValue,
    value: controlled,
    placeholder = 'Select date...',
    variant = 'soft',
    size = 'md',
    pill,
    block,
    clearable,
    disabled,
    min,
    max,
    radius,
    onChange,
    dark = false,
    style,
  } = props;

  const [internal, setInternal] = useState<string | undefined>(defaultValue);
  const [open, setOpen] = useState(false);
  const selected = controlled ?? internal;
  const selDate = parseISO(selected);

  const [view, setView] = useState<Date>(() => selDate ?? new Date());

  const colors = controlColors(variant, dark);
  const corner = radius ?? (pill ? 999 : BLOCK_RADIUS_DEFAULT);
  const box = controlBoxStyle(size, variant, colors, corner, false);
  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const sheetBg = dark ? '#1b1c1e' : '#ffffff';
  const accent = dark ? '#4f9cf9' : '#2f6fed';

  const minD = parseISO(min);
  const maxD = parseISO(max);

  /** In Range. */
  function inRange(d: Date): boolean {
    if (minD && d < minD) return false;
    if (maxD && d > maxD) return false;
    return true;
  }

  /** Pick helper. */
  function pick(d: Date): void {
    const iso = toISO(d);
    if (controlled === undefined) setInternal(iso);
    onChange?.(iso);
    setOpen(false);
  }

  /** Clear helper. */
  function clear(): void {
    if (controlled === undefined) setInternal(undefined);
    onChange?.('');
  }

  /** Shift Month. */
  function shiftMonth(delta: number): void {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));

  const label = selDate
    ? `${MONTHS[selDate.getMonth()]} ${selDate.getDate()}, ${selDate.getFullYear()}`
    : placeholder;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => {
          setView(selDate ?? new Date());
          setOpen(true);
        }}
        style={[
          box,
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            alignSelf: block ? 'stretch' : 'flex-start',
            opacity: disabled ? 0.5 : 1,
          },
          ...(style ? (Array.isArray(style) ? style : [style]) : []),
        ]}
      >
        <RNText
          numberOfLines={1}
          style={{ flex: 1, color: selDate ? head : colors.placeholder, fontSize: 15, fontFamily: 'Calibre-Medium' }}
        >
          {label}
        </RNText>
        {clearable && selDate ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear" onPress={clear} hitSlop={8}>
            <Icon name="x" size={16} color={colors.placeholder} />
          </Pressable>
        ) : null}
        <Icon name="calendar" size={16} color={colors.placeholder} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => { setOpen(false); }}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }}
          onPress={() => { setOpen(false); }}
        >
          <Pressable
            style={{ backgroundColor: sheetBg, borderRadius: 16, padding: 16 }}
            onPress={() => {
              /* intentional no-op: swallow press so taps inside the sheet don't dismiss it */
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => { shiftMonth(-1); }} hitSlop={8}>
                <Icon name="chevronLeft" size={20} color={head} />
              </Pressable>
              <RNText style={{ flex: 1, textAlign: 'center', color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>
                {MONTHS[month]} {year}
              </RNText>
              <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => { shiftMonth(1); }} hitSlop={8}>
                <Icon name="chevronRight" size={20} color={head} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row' }}>
              {WEEKDAYS.map((w, i) => (
                <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 }}>
                  <RNText style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>{w}</RNText>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cells.map((d, i) => {
                if (!d) return <View key={i} style={{ width: `${100 / 7}%`, height: 40 }} />;
                const isSel = selDate != null && toISO(d) === toISO(selDate);
                const enabled = inRange(d);
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityLabel={toISO(d)}
                    accessibilityState={{ selected: isSel, disabled: !enabled }}
                    disabled={!enabled}
                    onPress={() => { pick(d); }}
                    style={{ width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSel ? accent : 'transparent',
                        opacity: enabled ? 1 : 0.3,
                      }}
                    >
                      <RNText
                        style={{
                          color: isSel ? '#ffffff' : head,
                          fontSize: 15,
                          fontFamily: 'Calibre-Medium',
                        }}
                      >
                        {d.getDate()}
                      </RNText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
