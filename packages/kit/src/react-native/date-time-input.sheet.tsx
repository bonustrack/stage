import { Pressable, Text as RNText, View } from 'react-native';
import { FONT_SIZE, fontName } from '../tokens';
import { ControlSheet } from './control-trigger';
import { buildCells, MONTHS, toISODate, wrapClock, type DateTimeMode } from './date-time-input.model';
import { Icon } from './icon';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export interface SheetColors {
  head: string;
  sub: string;
  sheetBg: string;
  accent: string;
}

export function sheetColorsFor(dark: boolean): SheetColors {
  return {
    head: dark ? '#ffffff' : '#000000',
    sub: dark ? '#7a7a7e' : '#8a929d',
    sheetBg: dark ? '#1b1c1e' : '#ffffff',
    accent: dark ? '#4f9cf9' : '#2f6fed',
  };
}

function DayCell(props: {
  d: Date | null;
  selDate: Date | null;
  inRange: (d: Date) => boolean;
  onPick: (d: Date) => void;
  colors: SheetColors;
}): React.ReactElement {
  const { d, selDate, inRange, onPick, colors } = props;
  if (!d) return <View style={{ width: `${100 / 7}%`, height: 40 }} />;
  const isSel = selDate != null && toISODate(d) === toISODate(selDate);
  const enabled = inRange(d);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={toISODate(d)}
      accessibilityState={{ selected: isSel, disabled: !enabled }}
      disabled={!enabled}
      onPress={() => {
        onPick(d);
      }}
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
        <RNText style={{ color: isSel ? '#ffffff' : colors.head, fontSize: FONT_SIZE.xs, fontFamily: fontName.sans }}>{d.getDate()}</RNText>
      </View>
    </Pressable>
  );
}

function MonthHeader(props: { month: number; year: number; head: string; onShift: (delta: number) => void }): React.ReactElement {
  const { month, year, head, onShift } = props;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        onPress={() => {
          onShift(-1);
        }}
        hitSlop={8}
      >
        <Icon name="chevronLeft" size={20} color={head} />
      </Pressable>
      <RNText style={{ flex: 1, textAlign: 'center', color: head, fontSize: FONT_SIZE.xs, fontFamily: fontName.head }}>
        {MONTHS[month]} {year}
      </RNText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next month"
        onPress={() => {
          onShift(1);
        }}
        hitSlop={8}
      >
        <Icon name="chevronRight" size={20} color={head} />
      </Pressable>
    </View>
  );
}

function Calendar(props: {
  view: Date;
  selDate: Date | null;
  colors: SheetColors;
  inRange: (d: Date) => boolean;
  onPick: (d: Date) => void;
  onShift: (delta: number) => void;
}): React.ReactElement {
  const { view, selDate, colors, inRange, onPick, onShift } = props;
  const cells = buildCells(view.getFullYear(), view.getMonth());
  return (
    <>
      <MonthHeader month={view.getMonth()} year={view.getFullYear()} head={colors.head} onShift={onShift} />
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w, i) => (
          <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 }}>
            <RNText style={{ color: colors.sub, fontSize: FONT_SIZE['3xs'], fontFamily: fontName.sans }}>{w}</RNText>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => (
          <DayCell key={i} d={d} selDate={selDate} inRange={inRange} onPick={onPick} colors={colors} />
        ))}
      </View>
    </>
  );
}

function Stepper(props: {
  value: number;
  size: number;
  label: string;
  colors: SheetColors;
  onChange: (value: number) => void;
}): React.ReactElement {
  const { value, size, label, colors, onChange } = props;
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        hitSlop={8}
        onPress={() => {
          onChange(wrapClock(value, 1, size));
        }}
      >
        <Icon name="chevronUp" size={20} color={colors.head} />
      </Pressable>
      <RNText
        accessibilityLabel={label}
        style={{ color: colors.head, fontSize: FONT_SIZE['2xl'], fontFamily: fontName.head, minWidth: 44, textAlign: 'center' }}
      >
        {String(value).padStart(2, '0')}
      </RNText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        hitSlop={8}
        onPress={() => {
          onChange(wrapClock(value, -1, size));
        }}
      >
        <Icon name="chevronDown" size={20} color={colors.head} />
      </Pressable>
    </View>
  );
}

export interface TimeDraft {
  hour: number;
  minute: number;
}

function TimeRow(props: {
  draft: TimeDraft;
  colors: SheetColors;
  onChange: (draft: TimeDraft) => void;
  onDone: () => void;
}): React.ReactElement {
  const { draft, colors, onChange, onDone } = props;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12 }}>
      <Stepper
        value={draft.hour}
        size={24}
        label="Hour"
        colors={colors}
        onChange={(hour) => {
          onChange({ ...draft, hour });
        }}
      />
      <RNText style={{ color: colors.head, fontSize: FONT_SIZE['2xl'], fontFamily: fontName.head }}>:</RNText>
      <Stepper
        value={draft.minute}
        size={60}
        label="Minute"
        colors={colors}
        onChange={(minute) => {
          onChange({ ...draft, minute });
        }}
      />
      <Pressable
        accessibilityRole="button"
        onPress={onDone}
        hitSlop={8}
        style={{ marginLeft: 12, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.accent }}
      >
        <RNText style={{ color: '#ffffff', fontSize: FONT_SIZE.xs, fontFamily: fontName.head }}>Done</RNText>
      </Pressable>
    </View>
  );
}

export interface DateTimeSheetProps {
  open: boolean;
  mode: DateTimeMode;
  view: Date;
  selDate: Date | null;
  time: TimeDraft;
  colors: SheetColors;
  inRange: (d: Date) => boolean;
  onPick: (d: Date) => void;
  onShift: (delta: number) => void;
  onTime: (draft: TimeDraft) => void;
  onDone: () => void;
  onClose: () => void;
}

export function DateTimeSheet(props: DateTimeSheetProps): React.ReactElement {
  const { open, mode, colors, onClose } = props;
  return (
    <ControlSheet open={open} onClose={onClose} panelStyle={{ backgroundColor: colors.sheetBg, borderRadius: 16, padding: 16 }}>
      {mode === 'time' ? null : (
        <Calendar
          view={props.view}
          selDate={props.selDate}
          colors={colors}
          inRange={props.inRange}
          onPick={props.onPick}
          onShift={props.onShift}
        />
      )}
      {mode === 'date' ? null : <TimeRow draft={props.time} colors={colors} onChange={props.onTime} onDone={props.onDone} />}
    </ControlSheet>
  );
}
