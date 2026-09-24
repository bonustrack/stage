import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import Animated, {
  Easing, ReduceMotion, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue,
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
  const always = ReduceMotion.Never;
  x.value = withSequence(
    always,
    withTiming(-copyWidth, { duration: BANNER.durationMs * remaining, easing: Easing.linear, reduceMotion: always }),
    withTiming(0, { duration: 0, reduceMotion: always }),
    withRepeat(withTiming(-copyWidth, { duration: BANNER.durationMs, easing: Easing.linear, reduceMotion: always }), -1, false, undefined, always),
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

function copiesToCover(viewportWidth: number, copyWidth: number): number {
  if (copyWidth <= 0) return BANNER.copies;
  return Math.max(BANNER.copies, Math.ceil(viewportWidth / copyWidth) + 2);
}

export function ScrollingBanner(): React.ReactElement {
  const [copyWidth, setCopyWidth] = useState(0);
  const { width } = useWindowDimensions();
  const copies = copiesToCover(width, copyWidth);
  const marquee = useMarquee(copyWidth);
  return (
    <Pressable onHoverIn={marquee.pause} onHoverOut={marquee.resume} accessibilityRole="none">
      <Box background={HERO_BLACK} style={{ overflow: 'hidden' }}>
        <Animated.View style={[{ alignSelf: 'flex-start' }, marquee.style]}>
          <Row>
            {Array.from({ length: copies }, (_, i) => (
              <BannerCopy key={i} onWidth={i === 0 ? setCopyWidth : undefined} />
            ))}
          </Row>
        </Animated.View>
      </Box>
    </Pressable>
  );
}
