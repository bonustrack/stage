import { useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { usePathname, useRouter } from 'expo-router';
import { homeRoute, useBoardHome } from './boardHome';
import { PAGER_SCREENS } from './pagerScreens';
import { PAGER_ORDER, PAGES, homeTabIndex, isHomeSlot, slotPage } from './pages';
import { swipedTabIndex } from './TabsPager.model';
import { Column } from '../layout';

export function TabsPager(): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();

  const boardHome = useBoardHome();
  const routeIndex = homeTabIndex(pathname);

  const panRef = useRef<GestureType | undefined>(undefined);

  const tx = useSharedValue(-routeIndex * width);
  const index = useSharedValue(routeIndex);
  const gestureDrivenTo = useSharedValue<number | null>(null);
  const lastWidth = useSharedValue(width);

  const navigate = (i: number): void => {
    const id = PAGER_ORDER[i];
    if (id) router.navigate(isHomeSlot(id) ? homeRoute() : PAGES[id].href);
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
    .enabled(slotPage(PAGER_ORDER[routeIndex] ?? 'chats', boardHome) !== 'board')
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      'worklet';
      const base = -index.value * width;
      let drag = e.translationX;
      if (index.value === 0 && drag > 0) drag = 0;
      else if (index.value === PAGER_ORDER.length - 1 && drag < 0) drag *= 0.25;
      tx.value = base + drag;
    })
    .onEnd((e) => {
      'worklet';
      const target = swipedTabIndex(index.value, width, e.translationX, e.velocityX);
      index.value = target;
      tx.value = withSpring(-target * width, { damping: 22, stiffness: 240, velocity: e.velocityX });
      if (target !== routeIndex) {
        gestureDrivenTo.value = target;
        runOnJS(navigate)(target);
      }
    });

  const stripStyle = useAnimatedStyle(() => ({
    flexDirection: 'row',
    width: width * PAGER_ORDER.length,
    flex: 1,
    transform: [{ translateX: tx.value }],
  }));

  return (
    <Column weight={1} style={{ overflow: 'hidden' }}>
      <GestureDetector gesture={pan}>
        <Animated.View style={stripStyle}>
          {PAGER_ORDER.map((id) => {
            const Body = PAGER_SCREENS[slotPage(id, boardHome)];
            return (
              <Column width={width} key={id} style={{ height: '100%' }}>
                <Body panRef={panRef} />
              </Column>
            );
          })}
        </Animated.View>
      </GestureDetector>
    </Column>
  );
}
