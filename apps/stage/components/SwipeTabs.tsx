
import { useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { Box } from './layout';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { usePathname, useRouter } from 'expo-router';

import {
  FLING_VELOCITY, PAGES, SWITCH_FRACTION, TAB_HREF, TAB_ORDER,
  indexOfPathname,
} from './SwipeTabs.config';

export function TabsPager(): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();

  const routeIndex = indexOfPathname(pathname);

  const panRef = useRef<GestureType | undefined>(undefined);

  const tx = useSharedValue(-routeIndex * width);
  const index = useSharedValue(routeIndex);
  const gestureDrivenTo = useSharedValue<number | null>(null);
  const lastWidth = useSharedValue(width);

  const navigate = (i: number): void => {
    const name = TAB_ORDER[i];
    if (name) router.navigate(TAB_HREF[name]);
  };

  useEffect(() => {
    const widthChanged = lastWidth.value !== width;
    lastWidth.value = width;

    if (gestureDrivenTo.value === routeIndex) {
      gestureDrivenTo.value = null;
      index.value = routeIndex;
      if (widthChanged) tx.value = -routeIndex * width;
      return;
    }

    if (index.value !== routeIndex) {
      index.value = routeIndex;
      tx.value = withTiming(-routeIndex * width, { duration: 220 });
    } else if (widthChanged) {
      tx.value = -routeIndex * width;
    }
  }, [routeIndex, width]);

  const pan = Gesture.Pan()
    .withRef(panRef)
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      'worklet';
      const base = -index.value * width;
      let drag = e.translationX;
      if (index.value === 0 && drag > 0) drag = 0;
      else if (index.value === TAB_ORDER.length - 1 && drag < 0) drag *= 0.25;
      tx.value = base + drag;
    })
    .onEnd((e) => {
      'worklet';
      const passed = Math.abs(e.translationX) > width * SWITCH_FRACTION;
      const flung = Math.abs(e.velocityX) > FLING_VELOCITY;
      let target = index.value;
      if (passed || flung) {
        if (e.translationX < 0 && index.value < TAB_ORDER.length - 1) target = index.value + 1;
        else if (e.translationX > 0 && index.value > 0) target = index.value - 1;
      }
      index.value = target;
      tx.value = withSpring(-target * width, {
        damping: 22, stiffness: 240, velocity: e.velocityX,
      });
      if (target !== routeIndex) {
        gestureDrivenTo.value = target;
        runOnJS(navigate)(target);
      }
    });

  const stripStyle = useAnimatedStyle(() => ({
    flexDirection: 'row',
    width: width * TAB_ORDER.length,
    flex: 1,
    transform: [{ translateX: tx.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={stripStyle}>
        {TAB_ORDER.map((name) => {
          const Body = PAGES[name];
          return (
            <Box width={width} key={name} style={{ height: '100%' }}>
              <Body panRef={panRef}/>
            </Box>
          );
        })}
      </Animated.View>
    </GestureDetector>
  );
}
