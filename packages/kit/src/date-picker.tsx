
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

function parseISO(v: string | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function styleList(style: ViewStyle | ViewStyle[] | undefined): ViewStyle[] {
  if (!style) return [];
  return Array.isArray(style) ? style : [style];
}

function toISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export interface DatePickerProps {
  name?: string;
  defaultValue?: string;
  value?: string;
  placeholder?: string;
  variant?: ControlVariant;
  size?: ControlSize;
  pill?: boolean;
  block?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  radius?: number;
  onChange?: (value: string) => void;
  dark?: boolean;
  style?: ViewStyle | ViewStyle[];
}

function buildCells(year: number, month: number): (Date | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  return cells;
}

interface SheetColors {
  head: string;
  sub: string;
  sheetBg: string;
  accent: string;
}

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
          onPress={() => undefined}
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

function sheetColorsFor(dark: boolean): SheetColors {
  return {
    head: dark ? '#ffffff' : '#000000',
    sub: dark ? '#7a7a7e' : '#8a929d',
    sheetBg: dark ? '#1b1c1e' : '#ffffff',
    accent: dark ? '#4f9cf9' : '#2f6fed',
  };
}

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

  function inRange(d: Date): boolean {
    if (minD && d < minD) return false;
    if (maxD && d > maxD) return false;
    return true;
  }

  function pick(d: Date): void {
    const iso = toISO(d);
    if (controlled === undefined) setInternal(iso);
    onChange?.(iso);
    setOpen(false);
  }

  function clear(): void {
    if (controlled === undefined) setInternal(undefined);
    onChange?.('');
  }

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
