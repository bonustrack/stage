import { useState } from 'react';
import { router } from 'expo-router';
import { Platform, useWindowDimensions } from 'react-native';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { Box, Col, Row, ScreenScroll } from '../layout';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { desktopTitleBarInset } from '../../lib/webLayout';
import { SIGNUP_ROUTE } from '../onboarding/nextRoute.model';
import { ScrollingBanner } from './ScrollingBanner';
import {
  BANNER_HEIGHT, HERO_BLACK, HERO_BOX_LAYERS, HERO_COPY, HERO_LAYOUT, HERO_LOGO_SIZE, HERO_TYPE, HERO_WHITE, HERO_YELLOW,
  heroBoxes, type HeroBox, type HeroBoxLayer,
} from './Landing.model';
import Svg, { Rect } from 'react-native-svg';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { AsciiField } from './AsciiField';

const CELL = 100;
const CELLS: readonly (readonly [number, number])[] = [[200, 100], [100, 200], [300, 200], [200, 300]];
const CROPPED_VIEW_BOX = '100 100 300 300';

const STAGE_LOGO_SIZE = 64;

function StageLogo({ size = STAGE_LOGO_SIZE, color }: { size?: number; color: string }): React.ReactElement {
  return (
    <Pressable onPress={() => { router.navigate('/'); }} hitSlop={8} accessibilityLabel="Stage home">
      <Box width={size} height={size}>
        <Svg width={size} height={size} viewBox={CROPPED_VIEW_BOX}>
          {CELLS.map(([x, y]) => (
            <Rect key={`${x}-${y}`} x={x} y={y} width={CELL} height={CELL} fill={color} />
          ))}
        </Svg>
      </Box>
    </Pressable>
  );
}

interface Frame {
  width: number;
  height: number;
}

function BoxLayer({ layer, width, heroHeight }: { layer: HeroBoxLayer; width: number; heroHeight: number }): React.ReactElement {
  const [boxes] = useState<HeroBox[]>(() => heroBoxes(layer.count, width, HERO_LAYOUT.boxFrameHeight, Math.random));
  return (
    <Box
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: layer.top(heroHeight), width, height: HERO_LAYOUT.boxFrameHeight, overflow: 'hidden' }}
    >
      {boxes.map((box) => (
        <Box
          key={`${box.x}:${box.y}`} background={layer.color}
          style={{ position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height }}
        />
      ))}
    </Box>
  );
}

function HeroBackdrop({ width, height }: Frame): React.ReactElement {
  return (
    <>
      <Box
        background={HERO_YELLOW} pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, width, height: HERO_LAYOUT.bandHeight }}
      />
      <AsciiField width={width} height={height} />
      {HERO_BOX_LAYERS.map((layer) => (
        <BoxLayer key={layer.color} layer={layer} width={width} heroHeight={height} />
      ))}
    </>
  );
}

function HeroHeader(): React.ReactElement {
  return (
    <Row align="center" padding={{ y: HERO_LAYOUT.headerPadY }}>
      <Box
        background={HERO_YELLOW} height={HERO_LAYOUT.logoHeight}
        padding={{ x: HERO_LAYOUT.logoPadX, y: HERO_LAYOUT.logoPadY }}
      >
        <StageLogo size={HERO_LOGO_SIZE} color={HERO_BLACK} />
      </Box>
    </Row>
  );
}

function HeroCopy(): React.ReactElement {
  return (
    <Col>
      <Box background={HERO_YELLOW} padding={{ y: HERO_LAYOUT.blockPadY }} style={{ alignSelf: 'flex-start' }}>
        <Text
          size="sm" color={HERO_BLACK}
          style={{ letterSpacing: HERO_TYPE.eyebrow.letterSpacing, textTransform: 'uppercase' }}
        >
          {HERO_COPY.eyebrow}
        </Text>
      </Box>
      <Box background={HERO_YELLOW} width="100%" maxWidth={HERO_LAYOUT.blockMaxWidth} padding={{ y: HERO_LAYOUT.blockPadY }}>
        <Title hero="4xl" color={HERO_BLACK} accessibilityRole="header">
          {HERO_COPY.title}
        </Title>
      </Box>
    </Col>
  );
}

function HeroAction(): React.ReactElement {
  return (
    <Row justify="end">
      <Col width="100%" maxWidth={HERO_LAYOUT.blockMaxWidth}>
        <Box background={HERO_YELLOW} padding={{ y: HERO_LAYOUT.blockPadY }}>
          <Text
            size="3xl" color={HERO_BLACK}
            style={{ lineHeight: HERO_TYPE.paragraph.lineHeight }}
          >
            {HERO_COPY.paragraph}
          </Text>
        </Box>
        <Button
          size="xl" label={HERO_COPY.cta} tintBg={HERO_BLACK} tintFg={HERO_WHITE}
          accessibilityLabel="Get started" onPress={() => { router.navigate(SIGNUP_ROUTE); }}
        />
      </Col>
    </Row>
  );
}

export function Landing(): React.ReactElement {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? desktopTitleBarInset() : insets.top;
  const heroHeight = height - topInset - BANNER_HEIGHT;
  return (
    <ScreenScroll style={{ flex: 1, backgroundColor: HERO_WHITE }} contentContainerStyle={{ flexGrow: 1 }}>
      <Box background={HERO_BLACK} height={topInset} />
      <ScrollingBanner />
      <Col background={HERO_WHITE} minHeight={heroHeight} style={{ position: 'relative', overflow: 'hidden' }}>
        <HeroBackdrop width={width} height={heroHeight} />
        <HeroHeader />
        <Col flex={1}>
          <Col
            flex={1} width="100%" maxWidth={HERO_LAYOUT.containerMaxWidth}
            padding={{ x: HERO_LAYOUT.containerPadX, top: HERO_LAYOUT.contentPadY, bottom: HERO_LAYOUT.contentPadBottom }} gap={HERO_LAYOUT.contentGap}
            style={{ alignSelf: 'center' }}
          >
            <HeroCopy />
            <HeroAction />
          </Col>
        </Col>
      </Col>
    </ScreenScroll>
  );
}
