import { useState, type ReactNode } from 'react';
import { Text as RNText, View, type ViewStyle } from 'react-native';
import type { ValidationResult } from '../a2ui/protocol';
import { controlBoxStyle, controlColors, type ControlSize, type ControlVariant } from '../control.styles';
import { CONTROL_RADIUS_DEFAULT, FONT_SIZE, fontName } from '../tokens';
import { accessibilityProps, type A2uiCommonProps } from './a2ui-props';
import { ControlTrigger, WithChecks } from './control-trigger';
import {
  dateTimeMode, dayInRange, formatWallClock, parseWallClock, wallClockLabel, type DateTimeMode, type WallClock,
} from './date-time-input.model';
import { DateTimeSheet, sheetColorsFor, type TimeDraft } from './date-time-input.sheet';
import { useKitScheme } from './theme-context';
import { centralIcon } from '../central-icons';

export interface DateTimeInputProps extends A2uiCommonProps {
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  enableDate?: boolean;
  enableTime?: boolean;
  min?: string;
  max?: string;
  label?: string;
  checks?: readonly ValidationResult[];
  placeholder?: string;
  appearance?: ControlVariant;
  size?: ControlSize;
  pill?: boolean;
  block?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  radius?: number;
  dark?: boolean;
  style?: ViewStyle | ViewStyle[];
}

const PLACEHOLDER: Record<DateTimeMode, string> = {
  date: 'Select date...',
  time: 'Select time...',
  datetime: 'Select date and time...',
};

interface Draft {
  open: boolean;
  view: Date;
  date: Date | null;
  time: TimeDraft;
}

function draftFrom(clock: WallClock | null): Draft {
  const now = new Date();
  return {
    open: true,
    view: clock?.date ?? now,
    date: clock?.date ?? null,
    time: { hour: clock?.hour ?? now.getHours(), minute: clock?.minute ?? 0 },
  };
}

function useValue(props: DateTimeInputProps): [string | undefined, (next: string) => void] {
  const [internal, setInternal] = useState<string | undefined>(props.defaultValue);
  return [props.value ?? internal, (next) => {
    if (props.value === undefined) setInternal(next === '' ? undefined : next);
    props.onChange?.(next);
  }];
}

function useDraft(mode: DateTimeMode, clock: WallClock | null, commit: (next: string) => void) {
  const [draft, setDraft] = useState<Draft>(() => ({ ...draftFrom(clock), open: false }));
  const close = (): void => { setDraft((d) => ({ ...d, open: false })); };
  const finish = (date: Date | null, time: TimeDraft): void => {
    commit(formatWallClock(mode, date, time.hour, time.minute));
    close();
  };
  return {
    draft,
    open: () => { setDraft(draftFrom(clock)); },
    close,
    pick: (date: Date) => {
      if (mode === 'date') finish(date, draft.time);
      else setDraft((d) => ({ ...d, date }));
    },
    shift: (delta: number) => { setDraft((d) => ({ ...d, view: new Date(d.view.getFullYear(), d.view.getMonth() + delta, 1) })); },
    time: (time: TimeDraft) => { setDraft((d) => ({ ...d, time })); },
    done: () => { finish(draft.date ?? draft.view, draft.time); },
  };
}

function Labeled({ label, color, accessibility, children }: { label: string | undefined; color: string; accessibility: A2uiCommonProps['accessibility']; children: ReactNode }): React.ReactElement {
  if (label === undefined) return <>{children}</>;
  return (
    <View style={{ gap: 6 }} {...accessibilityProps(accessibility)}>
      <RNText style={{ color, fontSize: FONT_SIZE.xs, fontFamily: fontName.head }}>{label}</RNText>
      {children}
    </View>
  );
}

export function DateTimeInput(props: DateTimeInputProps): React.ReactElement {
  const { label, checks, appearance = 'soft', size = 'md', pill, block, clearable, disabled, min, max, radius, style, weight, accessibility } = props;
  const scheme = useKitScheme();
  const dark = props.dark ?? scheme === 'dark';
  const mode = dateTimeMode(props.enableDate, props.enableTime);
  const [selected, commit] = useValue(props);
  const clock = parseWallClock(selected);
  const sheet = useDraft(mode, clock, commit);
  const ctrl = controlColors(appearance, dark);
  const box = controlBoxStyle(size, appearance, ctrl, radius ?? (pill === true ? 999 : CONTROL_RADIUS_DEFAULT));
  const colors = sheetColorsFor(dark);
  const shown = wallClockLabel(mode, clock);
  return (
    <WithChecks checks={checks} weight={weight}>
      {(rootStyle) => (
        <Labeled label={label} color={colors.head} accessibility={accessibility}>
          <ControlTrigger
            disabled={disabled}
            block={block}
            clearable={clearable}
            open={sheet.draft.open}
            hasValue={shown !== undefined}
            label={shown ?? props.placeholder ?? PLACEHOLDER[mode]}
            icon={centralIcon(mode === 'time' ? 'clock' : 'calendar')}
            box={box}
            rootStyle={rootStyle}
            headColor={colors.head}
            placeholderColor={ctrl.placeholder}
            style={style}
            onOpen={sheet.open}
            onClear={() => { commit(''); }}
          />
          <DateTimeSheet
            open={sheet.draft.open}
            mode={mode}
            view={sheet.draft.view}
            selDate={mode === 'date' ? clock?.date ?? null : sheet.draft.date}
            time={sheet.draft.time}
            colors={colors}
            inRange={(d) => dayInRange(d, min, max)}
            onPick={sheet.pick}
            onShift={sheet.shift}
            onTime={sheet.time}
            onDone={sheet.done}
            onClose={sheet.close}
          />
        </Labeled>
      )}
    </WithChecks>
  );
}
