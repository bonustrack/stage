import type { BorderValue, Color, Dimension, SpacingValue } from './node-fields';
import {
  resolveBorder,
  resolveOptionalColor,
  resolveSpacing,
  type ResolvedBorders,
  type Scheme,
  type StyleEntries,
} from './resolve';

export const LIST_ITEM_INSET = 16;

export interface ListItemStyle {
  padding: StyleEntries;
  border?: ResolvedBorders;
  pressedBackground?: string;
  pressedBorderColor?: string;
  showDivider: boolean;
}

export interface ListItemStyleInput {
  padding?: SpacingValue;
  paddingX?: Dimension;
  paddingY?: Dimension;
  border?: BorderValue;
  pressedBackground?: Color;
  pressedBorderColor?: Color;
  showDivider?: boolean;
}

export function resolveListItemPadding(node: ListItemStyleInput): StyleEntries {
  const s: StyleEntries = {
    paddingTop: LIST_ITEM_INSET,
    paddingRight: LIST_ITEM_INSET,
    paddingBottom: LIST_ITEM_INSET,
    paddingLeft: LIST_ITEM_INSET,
  };
  if (node.padding !== undefined) {
    Object.assign(s, resolveSpacing(node.padding, 'padding'));
  }
  if (node.paddingX !== undefined) {
    s.paddingLeft = node.paddingX;
    s.paddingRight = node.paddingX;
  }
  if (node.paddingY !== undefined) {
    s.paddingTop = node.paddingY;
    s.paddingBottom = node.paddingY;
  }
  return s;
}

export function resolveListItemStyle(
  node: ListItemStyleInput,
  scheme: Scheme,
): ListItemStyle {
  return {
    padding: resolveListItemPadding(node),
    border:
      node.border === undefined ? undefined : resolveBorder(node.border, scheme),
    pressedBackground: resolveOptionalColor(node.pressedBackground, scheme),
    pressedBorderColor: resolveOptionalColor(node.pressedBorderColor, scheme),
    showDivider: node.showDivider === true,
  };
}
