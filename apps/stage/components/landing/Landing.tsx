import { router } from 'expo-router';
import { Platform, useWindowDimensions } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Col, Row, ScreenScroll } from '../layout';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { desktopTitleBarInset } from '../../lib/webLayout';
import { SIGNUP_ROUTE } from '../onboarding/nextRoute.model';
import { StageLogo } from './StageLogo';
import { HeroBackdrop } from './HeroBackdrop';
import { ScrollingBanner } from './ScrollingBanner';
import { BANNER_HEIGHT, HERO_BLACK, HERO_COPY, HERO_LAYOUT, HERO_LOGO_SIZE, HERO_TYPE, HERO_WHITE, HERO_YELLOW } from './Landing.model';

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
          color={HERO_BLACK}
          style={{ fontSize: HERO_TYPE.eyebrow.size, letterSpacing: HERO_TYPE.eyebrow.letterSpacing, textTransform: 'uppercase' }}
        >
          {HERO_COPY.eyebrow}
        </Text>
      </Box>
      <Box background={HERO_YELLOW} width="100%" maxWidth={HERO_LAYOUT.blockMaxWidth} padding={{ y: HERO_LAYOUT.blockPadY }}>
        <Text
          color={HERO_BLACK} accessibilityRole="header"
          style={{ fontSize: HERO_TYPE.title.size, lineHeight: HERO_TYPE.title.lineHeight }}
        >
          {HERO_COPY.title}
        </Text>
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
            color={HERO_BLACK}
            style={{ fontSize: HERO_TYPE.paragraph.size, lineHeight: HERO_TYPE.paragraph.lineHeight }}
          >
            {HERO_COPY.paragraph}
          </Text>
        </Box>
        <Pressable
          onPress={() => { router.navigate(SIGNUP_ROUTE); }}
          accessibilityRole="button" accessibilityLabel="Get started"
          style={{ alignSelf: 'flex-start' }}
        >
          <Box background={HERO_BLACK} radius="full" padding={{ x: HERO_LAYOUT.ctaPadX, y: HERO_LAYOUT.ctaPadY }}>
            <Text color={HERO_WHITE} style={{ fontSize: HERO_TYPE.cta.size, lineHeight: HERO_TYPE.cta.lineHeight }}>
              {HERO_COPY.cta}
            </Text>
          </Box>
        </Pressable>
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
            padding={{ x: HERO_LAYOUT.containerPadX, y: HERO_LAYOUT.contentPadY }} gap={HERO_LAYOUT.contentGap}
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
