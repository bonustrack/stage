import { Platform, type ViewStyle } from 'react-native';

const WEB = Platform.OS === 'web';
const PANE_LEFT = 'var(--stage-pane-left, 0px)';

type WebStyle = Record<string, string | number | undefined>;

function css(style: WebStyle): ViewStyle {
  return style;
}

export const PANE_LEFT_PAD: ViewStyle = WEB ? css({ paddingLeft: PANE_LEFT }) : {};

export const STICKY_TOP: ViewStyle = WEB ? css({ position: 'sticky', top: 0, zIndex: 2 }) : {};

export const STICKY_UNDER_CHROME: ViewStyle = WEB
  ? css({ position: 'sticky', top: 'var(--stage-top-inset, 0px)', zIndex: 2 })
  : {};

export function pinnedTop(zIndex: number): ViewStyle {
  return WEB
    ? css({ position: 'fixed', top: 0, left: PANE_LEFT, right: 0, zIndex })
    : { position: 'absolute', top: 0, left: 0, right: 0, zIndex };
}

export function pinnedBottom(zIndex: number): ViewStyle {
  return WEB
    ? css({ position: 'fixed', bottom: 0, left: PANE_LEFT, right: 0, zIndex })
    : { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex };
}

export function viewportFill(zIndex?: number): ViewStyle {
  const edges = { top: 0, bottom: 0, left: 0, right: 0, zIndex };
  return WEB ? css({ position: 'fixed', ...edges }) : { position: 'absolute', ...edges };
}

export function pinnedEdges(edges: { top?: number; bottom?: number; left?: number; right?: number }, zIndex: number): ViewStyle {
  return WEB ? css({ position: 'fixed', ...edges, zIndex }) : { position: 'absolute', ...edges, zIndex };
}
