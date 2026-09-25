import { useCallback, useMemo } from 'react';
import type { ImageLoadEventData, LayoutChangeEvent, NativeSyntheticEvent } from 'react-native';
import {
  Gesture, GestureDetector, type ComposedGesture, type PanGesture, type PinchGesture,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withDecay, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { getImageSize, Image } from '@stage-labs/kit/react-native/image';
import { ignore } from '../lib/errorPolicy';
import { useStableCallback } from '../lib/useStableCallback';
import { validSize } from './bubble/imageBox.model';
import {
  clampOffset, doubleTapTarget, fromCenter, isZoomed, panLimits, zoomAround, ZOOM_RESET,
  type ZoomGeometry, type ZoomPoint, type ZoomSize, type ZoomState,
} from './ZoomableImage.model';

const TAP_SLOP = 12;
const DOUBLE_TAP_DELAY_MS = 250;
const SETTLE_MS = 200;

interface ZoomValues {
  scale: SharedValue<number>;
  x: SharedValue<number>;
  y: SharedValue<number>;
  view: SharedValue<ZoomSize>;
  natural: SharedValue<ZoomSize>;
  pinchStart: SharedValue<{ state: ZoomState; focal: ZoomPoint }>;
  pointers: SharedValue<number>;
  frame: ZoomPoint;
}

function useZoomValues(frame: ZoomPoint): ZoomValues {
  const scale = useSharedValue(ZOOM_RESET.scale);
  const x = useSharedValue(ZOOM_RESET.x);
  const y = useSharedValue(ZOOM_RESET.y);
  const view = useSharedValue<ZoomSize>({ width: 0, height: 0 });
  const natural = useSharedValue<ZoomSize>({ width: 0, height: 0 });
  const pinchStart = useSharedValue({ state: ZOOM_RESET, focal: { x: 0, y: 0 } });
  const pointers = useSharedValue(0);
  return useMemo(
    () => ({ scale, x, y, view, natural, pinchStart, pointers, frame }),
    [scale, x, y, view, natural, pinchStart, pointers, frame],
  );
}

function geometryOf(z: ZoomValues): ZoomGeometry {
  'worklet';
  return { view: z.view.value, natural: z.natural.value, frame: z.frame };
}

function stateOf(z: ZoomValues): ZoomState {
  'worklet';
  return { scale: z.scale.value, x: z.x.value, y: z.y.value };
}

function place(z: ZoomValues, next: ZoomState): void {
  'worklet';
  z.scale.value = next.scale;
  z.x.value = next.x;
  z.y.value = next.y;
}

function settle(z: ZoomValues, next: ZoomState): void {
  'worklet';
  z.scale.value = withTiming(next.scale, { duration: SETTLE_MS });
  z.x.value = withTiming(next.x, { duration: SETTLE_MS });
  z.y.value = withTiming(next.y, { duration: SETTLE_MS });
}

function glide(z: ZoomValues, velocityX: number, velocityY: number): void {
  'worklet';
  if (!isZoomed(z.scale.value)) return;
  const limits = panLimits(geometryOf(z), z.scale.value);
  z.x.value = withDecay({ velocity: velocityX, clamp: [-limits.x, limits.x] });
  z.y.value = withDecay({ velocity: velocityY, clamp: [-limits.y, limits.y] });
}

function pinchGesture(z: ZoomValues): PinchGesture {
  return Gesture.Pinch()
    .onStart((e) => {
      z.pinchStart.value = { state: stateOf(z), focal: fromCenter(e.focalX, e.focalY, z.view.value) };
    })
    .onUpdate((e) => {
      const { state, focal } = z.pinchStart.value;
      place(z, zoomAround(state, focal, fromCenter(e.focalX, e.focalY, z.view.value), e.scale, geometryOf(z)));
    })
    .onEnd(() => {
      if (!isZoomed(z.scale.value)) settle(z, ZOOM_RESET);
    });
}

function panGesture(z: ZoomValues): PanGesture {
  return Gesture.Pan()
    .onStart((e) => { z.pointers.value = e.numberOfPointers; })
    .onChange((e) => {
      const steady = e.numberOfPointers === z.pointers.value;
      z.pointers.value = e.numberOfPointers;
      if (!steady || e.numberOfPointers > 1) return;
      const offset = clampOffset({ x: z.x.value + e.changeX, y: z.y.value + e.changeY }, geometryOf(z), z.scale.value);
      z.x.value = offset.x;
      z.y.value = offset.y;
    })
    .onEnd((e) => { glide(z, e.velocityX, e.velocityY); });
}

function useZoomGesture(z: ZoomValues, onTap: () => void): ComposedGesture {
  return useMemo(() => {
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(DOUBLE_TAP_DELAY_MS)
      .maxDistance(TAP_SLOP)
      .onEnd((e, success) => {
        if (success) settle(z, doubleTapTarget(stateOf(z), fromCenter(e.x, e.y, z.view.value), geometryOf(z)));
      });
    const tap = Gesture.Tap()
      .maxDistance(TAP_SLOP)
      .onEnd((_e, success) => {
        if (success && !isZoomed(z.scale.value)) runOnJS(onTap)();
      });
    return Gesture.Race(
      Gesture.Simultaneous(pinchGesture(z), panGesture(z)),
      Gesture.Exclusive(doubleTap, tap),
    );
  }, [z, onTap]);
}

export function ZoomableImage({ uri, frame, onTap }: {
  uri: string; frame: ZoomPoint; onTap: () => void;
}): React.ReactElement {
  const z = useZoomValues(frame);
  const gesture = useZoomGesture(z, useStableCallback(onTap));
  const transform = useAnimatedStyle(() => ({
    transform: [{ translateX: z.x.value }, { translateY: z.y.value }, { scale: z.scale.value }],
  }));
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    z.view.value = { width, height };
  }, [z]);
  const onLoad = useCallback((event: NativeSyntheticEvent<ImageLoadEventData>) => {
    const learn = (measured: { width?: number; height?: number } | undefined): boolean => {
      const size = validSize(measured);
      if (size) z.natural.value = size;
      return size !== undefined;
    };
    if (!learn(event.nativeEvent.source)) ignore(getImageSize(uri).then(learn), 'ui');
  }, [z, uri]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        onLayout={onLayout}
        style={{ flex: 1, paddingHorizontal: frame.x, paddingVertical: frame.y }}
      >
        <Animated.View style={[{ flex: 1 }, transform]}>
          <Image src={uri} style={{ width: '100%', height: '100%' }} fit="contain" onLoad={onLoad}/>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
