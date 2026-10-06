import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { Dialog } from '@stage-labs/kit/react-native/dialog';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { DropdownMenu, DropdownMenuSheet } from '@stage-labs/kit/react-native/menu';
import { anchoredMenuStyle, type MenuPoint } from './AnchoredMenu.model';
import { dismissContextMenuProps } from '../lib/contextMenu';
import { documentScroll, isCoarsePointer, useWebTabRail } from '../lib/webLayout';
import { MENU_GAP } from './menuStyle';

const DESKTOP_MIN_WIDTH = 900;
export const MENU_WIDTH = 260;

export function useAnchoredMenus(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH && !isCoarsePointer();
}

export function menuPointOf(event: GestureResponderEvent): MenuPoint {
  const { pageX, pageY } = event.nativeEvent;
  const scroll = documentScroll();
  return { x: pageX - scroll.x, y: pageY - scroll.y };
}

interface AnchorRect { left: number; right: number; top: number; bottom: number; width: number }

function rectOf(node: unknown): AnchorRect | undefined {
  if (typeof node !== 'object' || node === null) return undefined;
  const target = node as { getBoundingClientRect?: () => AnchorRect };
  return target.getBoundingClientRect?.();
}

export function anchorRect(event: GestureResponderEvent): AnchorRect | undefined {
  return rectOf(event.currentTarget);
}

export function menuPointOnLayout(event: LayoutChangeEvent): MenuPoint | null {
  const rect = rectOf('target' in event.nativeEvent ? event.nativeEvent.target : undefined);
  return rect === undefined ? null : { x: rect.left, y: rect.bottom + MENU_GAP };
}

export function menuPointBelow(event: GestureResponderEvent): MenuPoint {
  const rect = anchorRect(event);
  return rect === undefined ? menuPointOf(event) : { x: rect.left, y: rect.bottom + MENU_GAP };
}

export function menuPointAbove(event: GestureResponderEvent): MenuPoint {
  const rect = anchorRect(event);
  return rect === undefined ? menuPointOf(event) : { x: rect.left, y: rect.top - MENU_GAP };
}

export function menuPointBelowEnd(event: GestureResponderEvent): MenuPoint {
  const rect = anchorRect(event);
  return rect === undefined ? menuPointOf(event) : { x: rect.right, y: rect.bottom + MENU_GAP };
}

export function AnchoredOverlay({ open, onClose, children }: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}): React.ReactElement {
  return (
    <Dialog open={open} onClose={onClose} animationType="none" backdropColor="transparent" fullBleedPanel>
      <Pressable
        onPress={onClose}
        style={StyleSheet.absoluteFill}
        {...dismissContextMenuProps(onClose)}
      >
        {children}
      </Pressable>
    </Dialog>
  );
}

export function AnchoredMenu({ visible, onClose, anchor, forceAnchor = false, avoidKeyboard, children }: {
  visible: boolean;
  onClose: () => void;
  anchor?: MenuPoint | null;
  forceAnchor?: boolean;
  avoidKeyboard?: boolean;
  children: ReactNode;
}): React.ReactElement {
  const anchored = useAnchoredMenus();
  const viewport = useWindowDimensions();
  const centered = useWebTabRail();

  if ((!anchored && !forceAnchor) || !anchor) {
    return (
      <DropdownMenuSheet open={visible} onClose={onClose} side={centered ? 'center' : 'bottom'} maxWidth={MENU_WIDTH} avoidKeyboard={avoidKeyboard}>
        {children}
      </DropdownMenuSheet>
    );
  }

  const { maxHeight, ...position } = anchoredMenuStyle(anchor, viewport);
  return (
    <AnchoredOverlay open={visible} onClose={onClose}>
      <Pressable
        onPress={(e) => { e.stopPropagation(); }}
        style={{ position: 'absolute', ...position }}
      >
        <DropdownMenu maxHeight={maxHeight}>{children}</DropdownMenu>
      </Pressable>
    </AnchoredOverlay>
  );
}
