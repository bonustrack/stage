import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchReleases } from '@stage-labs/client/api/releases';
import { Button } from '@stage-labs/kit/react-native/button';
import { BrandIcon } from '@stage-labs/kit/react-native/icon';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col, Row } from '../layout';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { capabilities } from '../../lib/capabilities';
import { inBrowser } from '../../lib/desktopShell';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { StageLogo } from './StageLogo';
import { IMPORT_ROUTE, SIGNUP_ROUTE } from '../onboarding/nextRoute.model';
import { RELEASES_REPO, downloadLinks, type DownloadLink } from './Landing.model';

const CONTENT_MAX_WIDTH = 440;
const BUTTONS_MAX_WIDTH = 300;

function DownloadButton({ link, color }: { link: DownloadLink; color: string }): React.ReactElement {
  const href = link.href;
  if (href === null) {
    return (
      <Col align="center" gap={6} width={72} style={{ opacity: 0.35 }} accessibilityLabel={`${link.label} coming soon`}>
        <BrandIcon name={link.icon} size={26} color={color} />
        <Text size="xs" color="secondary">{link.label}</Text>
      </Col>
    );
  }
  return (
    <Pressable onPress={() => { capabilities.openUrl(href); }} hitSlop={6} accessibilityLabel={`Download for ${link.label}`}>
      <Col align="center" gap={6} width={72}>
        <BrandIcon name={link.icon} size={26} color={color} />
        <Text size="xs" color="secondary">{link.label}</Text>
      </Col>
    </Pressable>
  );
}

function Downloads({ color }: { color: string }): React.ReactElement | null {
  const browser = inBrowser();
  const { data } = useQuery({
    queryKey: ['releases', RELEASES_REPO.owner, RELEASES_REPO.repo],
    queryFn: () => fetchReleases(RELEASES_REPO.owner, RELEASES_REPO.repo),
    enabled: browser,
    staleTime: 10 * 60_000,
  });
  if (!browser) return null;
  return (
    <Col align="center" padding={{ top: 24 }}>
      <Row justify="center" wrap gap={8}>
        {downloadLinks(data).map((link) => <DownloadButton key={link.platform} link={link} color={color} />)}
      </Row>
    </Col>
  );
}

export function Landing(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Col
      surface="surface" flex={1} align="center" justify="center"
      padding={{ x: 24, top: 24 + insets.top, bottom: 24 + insets.bottom }}
    >
      <Col align="center" gap={20} width="100%" maxWidth={CONTENT_MAX_WIDTH}>
        <StageLogo color={pal.primary} />
        <Col gap={10} width="100%" maxWidth={BUTTONS_MAX_WIDTH} padding={{ top: 12 }}>
          <Button label="Sign up" block size="lg" color="primary" variant="solid" dark={dark}
            onPress={() => { router.navigate(SIGNUP_ROUTE); }} />
          <Button label="Log in" block size="lg" color="primary" variant="soft" dark={dark}
            onPress={() => { router.navigate(IMPORT_ROUTE); }} />
        </Col>
        <Downloads color={pal.text} />
      </Col>
    </Col>
  );
}
