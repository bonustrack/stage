export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
export const ZOOM_DOUBLE_TAP = 2.5;

const ZOOMED_EPSILON = 0.01;

export interface ZoomSize { width: number; height: number }
export interface ZoomPoint { x: number; y: number }
export interface ZoomState extends ZoomPoint { scale: number }
export interface ZoomGeometry { view: ZoomSize; natural: ZoomSize; frame: ZoomPoint }

export const ZOOM_RESET: ZoomState = { scale: ZOOM_MIN, x: 0, y: 0 };

export function clampZoom(scale: number): number {
  'worklet';
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale));
}

export function isZoomed(scale: number): boolean {
  'worklet';
  return scale > ZOOM_MIN + ZOOMED_EPSILON;
}

export function fromCenter(x: number, y: number, view: ZoomSize): ZoomPoint {
  'worklet';
  return { x: x - view.width / 2, y: y - view.height / 2 };
}

function fittedSize(geometry: ZoomGeometry): ZoomSize {
  'worklet';
  const box = {
    width: Math.max(0, geometry.view.width - 2 * geometry.frame.x),
    height: Math.max(0, geometry.view.height - 2 * geometry.frame.y),
  };
  const { natural } = geometry;
  if (natural.width <= 0 || natural.height <= 0) return box;
  const ratio = Math.min(box.width / natural.width, box.height / natural.height);
  return { width: natural.width * ratio, height: natural.height * ratio };
}

export function panLimits(geometry: ZoomGeometry, scale: number): ZoomPoint {
  'worklet';
  const fitted = fittedSize(geometry);
  return {
    x: Math.max(0, (fitted.width * scale - geometry.view.width) / 2),
    y: Math.max(0, (fitted.height * scale - geometry.view.height) / 2),
  };
}

function clampAxis(offset: number, limit: number): number {
  'worklet';
  if (limit <= 0) return 0;
  return Math.min(limit, Math.max(-limit, offset));
}

export function clampOffset(offset: ZoomPoint, geometry: ZoomGeometry, scale: number): ZoomPoint {
  'worklet';
  const limits = panLimits(geometry, scale);
  return { x: clampAxis(offset.x, limits.x), y: clampAxis(offset.y, limits.y) };
}

export function zoomAround(
  start: ZoomState, startFocal: ZoomPoint, focal: ZoomPoint, pinchScale: number, geometry: ZoomGeometry,
): ZoomState {
  'worklet';
  const scale = clampZoom(start.scale * pinchScale);
  const ratio = scale / start.scale;
  const offset = {
    x: focal.x - ratio * (startFocal.x - start.x),
    y: focal.y - ratio * (startFocal.y - start.y),
  };
  return { scale, ...clampOffset(offset, geometry, scale) };
}

export function doubleTapTarget(current: ZoomState, tap: ZoomPoint, geometry: ZoomGeometry): ZoomState {
  'worklet';
  if (isZoomed(current.scale)) return ZOOM_RESET;
  return zoomAround(current, tap, tap, ZOOM_DOUBLE_TAP / current.scale, geometry);
}
