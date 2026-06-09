/** First-launch ONBOARDING carousel.
 *
 *  A full-screen, three-slide horizontal pager (a paging FlatList - no extra
 *  pager dependency) shown exactly once on a clean install. The root layout
 *  (app/_layout.tsx) gates the whole app behind this: until the persisted
 *  `onboarding.seen` flag is true the user sees this flow instead of the app,
 *  and tapping "Get started" on the last slide flips the flag and lets them in.
 *
 *  Each slide is an icon + short title + one-sentence body explaining Metro (a
 *  private messaging + wallet app). Teal-leaning accents come from the live
 *  `link` palette token so the flow re-themes with the rest of the app. A "Skip"
 *  shortcut (visible until the last slide) and page dots round it out.
 *
 *  Self-contained: it owns no navigation, just an `onDone` callback the layout
 *  wires to "set seen + enter app". The Experimental "Replay onboarding" row
 *  resets the flag so this shows again for testing. */

import { useCallback, useRef, useState } from 'react';

import {
  FlatList,
  Pressable,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { Box, Row, Col } from '../layout';
import { useEffectiveColorScheme, usePalette, withAlpha } from '../../lib/theme';

interface Slide {
  icon: HeroIconName;
  title: string;
  body: string;
}

/** On-brand copy: private messaging + self-custody wallet, concise. */
const SLIDES: Slide[] = [
  {
    icon: 'chatBubble',
    title: 'Welcome to Stage',
    body: 'Private, end-to-end encrypted messaging - wallet to wallet, no phone number, no email.',
  },
  {
    icon: 'wallet',
    title: 'Your wallet, your keys',
    body: 'Hold and move your assets right inside your chats - send tokens as easily as a message.',
  },
  {
    icon: 'shieldCheck',
    title: 'Private by default',
    body: 'Your conversations and keys stay on your device. You are in control, always.',
  },
];

export interface OnboardingProps {
  /** Called when the user finishes (Get started) or skips. The layout flips the
   *  persisted seen flag and lets the user into the app. */
  onDone: () => void;
}

export function Onboarding({ onDone }: OnboardingProps): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { bg, text: fg, link: accent } = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const isLast = index >= SLIDES.length - 1;

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
      setIndex((cur) => (cur === next ? cur : next));
    },
    [width],
  );

  const goNext = useCallback((): void => {
    if (isLast) {
      onDone();
      return;
    }
    const next = index + 1;
    listRef.current?.scrollToOffset({ offset: next * width, animated: true });
    setIndex(next);
  }, [index, isLast, onDone, width]);

  return (
    <Col flex={1} style={{ backgroundColor: bg }}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Col flex={1}
            align="center" justify="center" px={36} style={{ width }}
          >
            <Box
              align="center" justify="center" mb={40} style={{ width: 128, height: 128, borderRadius: 64, backgroundColor: withAlpha(accent, 0.12) }}
            >
              <Icon name={item.icon} size={56} color={accent} />
            </Box>
            <Text weight="semibold" size="6xl" color={fg} style={{ textAlign: 'center', marginBottom: 14 }}>
              {item.title}
            </Text>
            <Text size="xl" color={withAlpha(fg, 0.7)} style={{ lineHeight: 24, textAlign: 'center' }}>
              {item.body}
            </Text>
          </Col>
        )}
      />

      {/* Page dots */}
      <Row
        justify="center" gap={8} mb={24}
      >
        {SLIDES.map((s, i) => (
          <Box
            key={s.title}
            style={{
              width: i === index ? 22 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === index ? accent : withAlpha(fg, 0.2),
            }}
          />
        ))}
      </Row>

      {/* Footer: Get started (last) / Next, plus Skip until the last slide */}
      <Box px={24} pb={16 + insets.bottom} gap={12}>
        <Button
          dark={dark}
          variant="primary"
          size="lg"
          fullWidth
          tintBg={accent}
          tintFg={bg}
          label={isLast ? 'Get started' : 'Next'}
          onPress={goNext}
        />
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          style={{ alignItems: 'center', paddingVertical: 8, opacity: isLast ? 0 : 1 }}
          disabled={isLast}
        >
          <Text size="md" color={withAlpha(fg, 0.6)}>
            Skip
          </Text>
        </Pressable>
      </Box>
    </Col>
  );
}
