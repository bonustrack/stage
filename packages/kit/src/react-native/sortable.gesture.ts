import { useEffect, useMemo, type ReactNode } from 'react';
import type { AccessibilityActionEvent } from 'react-native';
import { Gesture, type PanGesture } from 'react-native-gesture-handler';
import type { SortDirection, SortStep } from '../sortable';
import type { ListContextValue } from './sortable.context';
import { isTouchPointer, listenKeys, suppressNextClick } from './sortable.platform';

const HOLD_MS = 250;
const MOVE_SLOP = 6;
const SORT_STEPS: readonly SortStep[] = ['backward', 'forward', 'previousList', 'nextList'];

const KEY_STEPS: Record<SortDirection, Record<string, SortStep>> = {
  vertical: { ArrowUp: 'backward', ArrowDown: 'forward', ArrowLeft: 'previousList', ArrowRight: 'nextList' },
  horizontal: { ArrowLeft: 'backward', ArrowRight: 'forward', ArrowUp: 'previousList', ArrowDown: 'nextList' },
};

export function useKeyboard(list: ListContextValue, itemId: string, node: () => unknown, preview: () => ReactNode, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const { coordinator, listId, direction } = list;
    return listenKeys(node(), (key) => {
      const lifted = coordinator.state().drag?.itemId === itemId && coordinator.state().drag?.keyboard === true;
      const step = KEY_STEPS[direction][key];
      if (key === ' ' || key === 'Enter') {
        if (lifted) coordinator.keyDrop();
        else coordinator.keyLift(listId, itemId, preview());
        return true;
      }
      if (!lifted) return false;
      if (key === 'Escape') {
        coordinator.keyCancel();
        return true;
      }
      if (step !== undefined) {
        coordinator.keyStep(step);
        return true;
      }
      return false;
    });
  }, [list, itemId, node, preview, enabled]);
}

function accessibilityActions(list: ListContextValue): { name: SortStep; label: string }[] {
  const along = list.direction === 'vertical' ? ['Move up', 'Move down'] : ['Move left', 'Move right'];
  const base: { name: SortStep; label: string }[] = [
    { name: 'backward', label: along[0] ?? '' },
    { name: 'forward', label: along[1] ?? '' },
  ];
  if (list.coordinator.groupSize(list.group) < 2) return base;
  return [...base, { name: 'previousList', label: 'Move to previous list' }, { name: 'nextList', label: 'Move to next list' }];
}

export function accessibilityProps(list: ListContextValue, itemId: string, enabled: boolean) {
  if (!enabled || !list.keyboard) return {};
  return {
    accessibilityActions: accessibilityActions(list),
    onAccessibilityAction: (event: AccessibilityActionEvent): void => {
      const step = SORT_STEPS.find((name) => name === event.nativeEvent.actionName);
      if (step !== undefined) list.coordinator.moveBy(list.listId, itemId, step);
    },
  };
}

export function usePan(
  list: ListContextValue,
  itemId: string,
  preview: () => ReactNode,
  onHold: ((point: { x: number; y: number }) => void) | undefined,
  enabled: boolean,
): PanGesture {
  const touch = isTouchPointer();
  return useMemo(() => {
    const { coordinator, listId } = list;
    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(enabled)
      .onBegin((e) => {
        coordinator.press({ x: e.absoluteX, y: e.absoluteY });
      })
      .onStart((e) => {
        coordinator.begin(listId, itemId, preview());
        coordinator.move({ x: e.absoluteX, y: e.absoluteY });
      })
      .onUpdate((e) => {
        coordinator.move({ x: e.absoluteX, y: e.absoluteY });
      })
      .onEnd((e, success) => {
        const moved = coordinator.wasMoved();
        if (!success) {
          coordinator.cancel();
          return;
        }
        coordinator.drop();
        if (moved || !touch || onHold === undefined) return;
        suppressNextClick();
        onHold({ x: e.absoluteX, y: e.absoluteY });
      })
      .onFinalize(() => {
        const drag = coordinator.state().drag;
        if (drag?.itemId === itemId && !drag.keyboard) coordinator.cancel();
      });
    if (touch) pan.activateAfterLongPress(HOLD_MS);
    else pan.minDistance(MOVE_SLOP);
    pan.config.touchAction = list.touchAction;
    return pan;
  }, [list, itemId, preview, onHold, enabled, touch]);
}
