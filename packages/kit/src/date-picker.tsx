/**
 * @file DatePicker — a hook-free ChatKit-styled date field backed by a self-contained calendar grid in a centred RN Modal (no native date dependency), emitting ISO YYYY-MM-DD strings.
 */

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

/** Normalise the escape-hatch style prop to a flat array. */
function styleList(style: ViewStyle | ViewStyle[] | undefined): ViewStyle[] {
  if (!style) return [];
  return Array.isArray(style) ? style : [style];
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

/** Build the calendar grid cells (leading blanks + day dates) for a month. */
function buildCells(year: number, month: number): (Date | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  return cells;
}

/** Calendar sheet colour set. */
interface SheetColors {
  head: string;
  sub: string;
  sheetBg: string;
  accent: string;
}

/** Single selectable day cell in the calendar grid. */
function DayCell(props: {
  d: Date | null;
  index: number;
  selDate: Date | null;
  inRange: (d: Date) => boolean;
  onPick: (d: Date) => void;
  colors: SheetColors;
}): React.ReactElement {
  const { d, index, selDate, inRange, onPick, colors } = props;
  if (!d) return <View key={index} style={{ width: `${100 / 7}%`, height: 40 }} />;
  const isSel = selDate != null && toISO(d) === toISO(selDate);
  const enabled = inRange(d);
  return (
    <Pressable
      key={index}
      accessibilityRole="button"
      accessibilityLabel={toISO(d)}
      accessibilityState={{ selected: isSel, disabled: !enabled }}
      disabled={!enabled}
      onPress={() => { onPick(d); }}
      style={{ width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isSel ? colors.accent : 'transparent',
          opacity: enabled ? 1 : 0.3,
        }}
      >
        <RNText style={{ color: isSel ? '#ffffff' : colors.head, fontSize: 15, fontFamily: 'Calibre-Medium' }}>
          {d.getDate()}
        </RNText>
      </View>
    </Pressable>
  );
}

/** Month header row with prev/next navigation. */
function MonthHeader(props: {
  month: number;
  year: number;
  head: string;
  onShift: (delta: number) => void;
}): React.ReactElement {
  const { month, year, head, onShift } = props;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => { onShift(-1); }} hitSlop={8}>
        <Icon name="chevronLeft" size={20} color={head} />
      </Pressable>
      <RNText style={{ flex: 1, textAlign: 'center', color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>
        {MONTHS[month]} {year}
      </RNText>
      <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => { onShift(1); }} hitSlop={8}>
        <Icon name="chevronRight" size={20} color={head} />
      </Pressable>
    </View>
  );
}

/** Props for the calendar modal sheet. */
interface CalendarSheetProps {
  open: boolean;
  view: Date;
  selDate: Date | null;
  colors: SheetColors;
  inRange: (d: Date) => boolean;
  onPick: (d: Date) => void;
  onShift: (delta: number) => void;
  onClose: () => void;
}

/** Centred modal calendar grid for the date picker. */
function CalendarSheet(props: CalendarSheetProps): React.ReactElement {
  const { open, view, selDate, colors, inRange, onPick, onShift, onClose } = props;
  const year = view.getFullYear();
  const month = view.getMonth();
  const cells = buildCells(year, month);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }}
        onPress={onClose}
      >
        <Pressable
          style={{ backgroundColor: colors.sheetBg, borderRadius: 16, padding: 16 }}
          onPress={() => {
            /* intentional no-op: swallow press so taps inside the sheet don't dismiss it */
          }}
        >
          <MonthHeader month={month} year={year} head={colors.head} onShift={onShift} />
          <View style={{ flexDirection: 'row' }}>
            {WEEKDAYS.map((w, i) => (
              <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 }}>
                <RNText style={{ color: colors.sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>{w}</RNText>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((d, i) => (
              <DayCell key={i} d={d} index={i} selDate={selDate} inRange={inRange} onPick={onPick} colors={colors} />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Props for the date picker trigger box. */
interface DateTriggerProps {
  name?: string;
  disabled?: boolean;
  block?: boolean;
  clearable?: boolean;
  open: boolean;
  selDate: Date | null;
  label: string;
  box: ViewStyle;
  ctrlColors: ReturnType<typeof controlColors>;
  headColor: string;
  style?: ViewStyle | ViewStyle[];
  onOpen: () => void;
  onClear: () => void;
}

/** Pressable trigger box showing the selected date and affordances. */
function DateTrigger(props: DateTriggerProps): React.ReactElement {
  const { name, disabled, block, clearable, open, selDate, label, box, ctrlColors, headColor, style, onOpen, onClear } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ disabled, expanded: open }}
      disabled={disabled}
      onPress={onOpen}
      style={[
        box,
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          alignSelf: block ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.5 : 1,
        },
        ...styleList(style),
      ]}
    >
      <RNText
        numberOfLines={1}
        style={{ flex: 1, color: selDate ? headColor : ctrlColors.placeholder, fontSize: 15, fontFamily: 'Calibre-Medium' }}
      >
        {label}
      </RNText>
      {clearable && selDate ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear" onPress={onClear} hitSlop={8}>
          <Icon name="x" size={16} color={ctrlColors.placeholder} />
        </Pressable>
      ) : null}
      <Icon name="calendar" size={16} color={ctrlColors.placeholder} />
    </Pressable>
  );
}

/** Build the calendar sheet colour set for a scheme. */
function sheetColorsFor(dark: boolean): SheetColors {
  return {
    head: dark ? '#ffffff' : '#000000',
    sub: dark ? '#7a7a7e' : '#8a929d',
    sheetBg: dark ? '#1b1c1e' : '#ffffff',
    accent: dark ? '#4f9cf9' : '#2f6fed',
  };
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

  const ctrlColors = controlColors(variant, dark);
  const corner = radius ?? (pill ? 999 : BLOCK_RADIUS_DEFAULT);
  const box = controlBoxStyle(size, variant, ctrlColors, corner, false);
  const sheetColors = sheetColorsFor(dark);

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

  const label = selDate
    ? `${MONTHS[selDate.getMonth()]} ${selDate.getDate()}, ${selDate.getFullYear()}`
    : placeholder;

  return (
    <>
      <DateTrigger
        name={name}
        disabled={disabled}
        block={block}
        clearable={clearable}
        open={open}
        selDate={selDate}
        label={label}
        box={box}
        ctrlColors={ctrlColors}
        headColor={sheetColors.head}
        style={style}
        onOpen={() => {
          setView(selDate ?? new Date());
          setOpen(true);
        }}
        onClear={clear}
      />

      <CalendarSheet
        open={open}
        view={view}
        selDate={selDate}
        colors={sheetColors}
        inRange={inRange}
        onPick={pick}
        onShift={shiftMonth}
        onClose={() => { setOpen(false); }}
      />
    </>
  );
}
