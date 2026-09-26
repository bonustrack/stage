import { useMemo, useRef, type ReactNode } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { View, type ViewType } from '../layout/native';
import { hideRailTooltip, showRailTooltip, tooltipLabel, tooltipState } from '../../lib/railTooltip';

const PEEK_MS = 250;

export function ReactionTooltip({ label, emoji, onReact, children }: {
  label: string; emoji: string; onReact?: (emoji: string) => void; children: ReactNode;
}): React.ReactElement {
  const ref = useRef<ViewType>(null);
  const gesture = useMemo(() => {
    const show = (): void => {
      ref.current?.measureInWindow((left, top, width, height) => {
        showRailTooltip(tooltipState('above', tooltipLabel(label), { left, top, width, height }));
      });
    };
    const peek = Gesture.LongPress().minDuration(PEEK_MS)
      .onStart(() => { runOnJS(show)(); })
      .onFinalize(() => { runOnJS(hideRailTooltip)(); });
    if (!onReact) return peek;
    const tap = Gesture.Tap().onEnd((_e, ok) => { if (ok) runOnJS(onReact)(emoji); });
    return Gesture.Exclusive(peek, tap);
  }, [label, emoji, onReact]);
  return (
    <GestureDetector gesture={gesture}>
      <View ref={ref} collapsable={false}>{children}</View>
    </GestureDetector>
  );
}
