import { useEffect, useState } from 'react';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row } from '../layout';
import { BANNER, HERO_BLACK, HERO_WHITE } from './Landing.model';

function BannerCopy({ onWidth }: { onWidth?: (width: number) => void }): React.ReactElement {
  return (
    <Box
      padding={{ y: BANNER.padY, right: BANNER.padRight }}
      onLayout={onWidth ? (e) => { onWidth(e.nativeEvent.layout.width); } : undefined}
    >
      <Text color={HERO_WHITE} numberOfLines={1} style={{ fontSize: BANNER.size, lineHeight: BANNER.lineHeight }}>
        {BANNER.lead}
        <Text color={HERO_WHITE} style={{ fontSize: BANNER.size, lineHeight: BANNER.lineHeight, textDecorationLine: 'underline' }}>
          {BANNER.link}
        </Text>
        {BANNER.tail}
      </Text>
    </Box>
  );
}

function runMarquee(x: SharedValue<number>, copyWidth: number, from: number): void {
  if (copyWidth <= 0) return;
  const remaining = (copyWidth + from) / copyWidth;
  x.value = withSequence(
    withTiming(-copyWidth, { duration: BANNER.durationMs * remaining, easing: Easing.linear }),
    withTiming(0, { duration: 0 }),
    withRepeat(withTiming(-copyWidth, { duration: BANNER.durationMs, easing: Easing.linear }), -1, false),
  );
}

function useMarquee(copyWidth: number): { style: ReturnType<typeof useAnimatedStyle>; pause: () => void; resume: () => void } {
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = 0;
    runMarquee(x, copyWidth, 0);
    return (): void => { cancelAnimation(x); };
  }, [x, copyWidth]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return {
    style,
    pause: () => { cancelAnimation(x); },
    resume: () => { runMarquee(x, copyWidth, x.value); },
  };
}

export function ScrollingBanner(): React.ReactElement {
  const [copyWidth, setCopyWidth] = useState(0);
  const marquee = useMarquee(copyWidth);
  return (
    <Pressable onHoverIn={marquee.pause} onHoverOut={marquee.resume} accessibilityRole="none">
      <Box background={HERO_BLACK} style={{ overflow: 'hidden' }}>
        <Animated.View style={[{ alignSelf: 'flex-start' }, marquee.style]}>
          <Row>
            {Array.from({ length: BANNER.copies }, (_, i) => (
              <BannerCopy key={i} onWidth={i === 0 ? setCopyWidth : undefined} />
            ))}
          </Row>
        </Animated.View>
      </Box>
    </Pressable>
  );
}
