import { useMemo, useRef, useState } from 'react';
import {
  PanResponder, Text as RNText, View, type AccessibilityActionEvent, type GestureResponderEvent, type ViewStyle,
} from 'react-native';
import type { ValidationResult } from '../a2ui/protocol';
import { styleList } from '../control.styles';
import { FONT_SIZE, fontName, schemePalette } from '../tokens';
import { accessibilityProps, type A2uiCommonProps } from './a2ui-props';
import { WithChecks } from './control-trigger';
import { useKitScheme } from './theme-context';

export interface SliderProps extends A2uiCommonProps {
  label?: string;
  min?: number;
  max: number;
  value?: number;
  defaultValue?: number;
  steps?: number;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  checks?: readonly ValidationResult[];
  disabled?: boolean;
  dark?: boolean;
  showValue?: boolean;
  style?: ViewStyle | ViewStyle[];
}

const THUMB = 20;
const TRACK = 4;
const TOUCH_HEIGHT = 28;

function sliderValue(fraction: number, min: number, max: number, steps: number | undefined): number {
  const clamped = Math.min(1, Math.max(0, fraction));
  const raw = min + clamped * (max - min);
  if (steps === undefined || steps <= 0) return raw;
  const step = (max - min) / steps;
  return min + Math.round((raw - min) / step) * step;
}

function sliderFraction(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function useSliderState(props: SliderProps): [number, (next: number) => void] {
  const [internal, setInternal] = useState(props.defaultValue ?? props.min ?? 0);
  const value = props.value ?? internal;
  return [value, (next) => {
    if (props.value === undefined) setInternal(next);
    props.onChange?.(next);
  }];
}

function useDrag(props: SliderProps, update: (next: number) => void, latest: { current: number }) {
  const drag = useRef({ width: 0, startX: 0 });
  const min = props.min ?? 0;
  const at = (x: number): number => sliderValue(drag.current.width === 0 ? 0 : x / drag.current.width, min, props.max, props.steps);
  const handlers = useRef({ at, update, end: props.onChangeEnd });
  handlers.current = { at, update, end: props.onChangeEnd };
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e: GestureResponderEvent) => {
      drag.current.startX = e.nativeEvent.locationX;
      handlers.current.update(handlers.current.at(drag.current.startX));
    },
    onPanResponderMove: (_e, gesture) => {
      handlers.current.update(handlers.current.at(drag.current.startX + gesture.dx));
    },
    onPanResponderRelease: () => {
      handlers.current.end?.(latest.current);
    },
  }), [latest]);
  return { drag, responder };
}

export function Slider(props: SliderProps): React.ReactElement {
  const { label, max, steps, checks, disabled = false, showValue = true, style, weight, accessibility } = props;
  const min = props.min ?? 0;
  const scheme = useKitScheme();
  const p = schemePalette(props.dark ?? scheme === 'dark');
  const [value, update] = useSliderState(props);
  const latest = useRef(value);
  latest.current = value;
  const { drag, responder } = useDrag(props, update, latest);
  const pct = `${sliderFraction(value, min, max) * 100}%` as const;
  const nudge = (e: AccessibilityActionEvent): void => {
    const step = steps !== undefined && steps > 0 ? (max - min) / steps : (max - min) / 100;
    const next = Math.min(max, Math.max(min, value + (e.nativeEvent.actionName === 'increment' ? step : -step)));
    update(next);
    props.onChangeEnd?.(next);
  };
  return (
    <WithChecks checks={checks} weight={weight}>
      {(rootStyle) => (
        <View style={[{ gap: 6, opacity: disabled ? 0.5 : 1 }, ...styleList(style), ...styleList(rootStyle)]}>
          {label === undefined ? null : <RNText style={{ color: p.head, fontSize: FONT_SIZE.xs, fontFamily: fontName.head }}>{label}</RNText>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              {...(disabled ? {} : responder.panHandlers)}
              accessibilityRole="adjustable"
              accessibilityLabel={label}
              accessibilityValue={{ min, max, now: value }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={disabled ? undefined : nudge}
              {...accessibilityProps(accessibility)}
              onLayout={(e) => { drag.current.width = e.nativeEvent.layout.width; }}
              style={{ flex: 1, height: TOUCH_HEIGHT, justifyContent: 'center', cursor: disabled ? undefined : 'pointer' }}
            >
              <View pointerEvents="none" style={{ height: TRACK, borderRadius: TRACK / 2, backgroundColor: p.border }}>
                <View style={{ width: pct, height: TRACK, borderRadius: TRACK / 2, backgroundColor: p.head }} />
              </View>
              <View pointerEvents="none" style={{ position: 'absolute', left: pct, marginLeft: -THUMB / 2, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: p.head }} />
            </View>
            {showValue ? <RNText style={{ minWidth: 36, textAlign: 'right', color: p.sub, fontSize: FONT_SIZE['2xs'], fontFamily: fontName.sans }}>{String(Number(value.toFixed(2)))}</RNText> : null}
          </View>
        </View>
      )}
    </WithChecks>
  );
}
