import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col, Row, PAGE_GUTTER } from '../layout';
import { GithubLogo } from '../GithubLogo';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import { buildMeta, commitUrl, STAGE_GITHUB_URL } from '../../lib/githubRepo';
import { timeAgo } from '../../lib/buildInfo.model';
import { devClientInfo } from '../../lib/devClientUpdates';
import { DevClientUpdate } from './DevClientUpdate';

const FOOTER_TEXT = { role: 'secondary', variant: 'caption', size: 'sm', weight: 'medium' } as const;
const GITHUB_ICON_SIZE = 14;

function resolveNativeBuild(): string | null {
  if (Application.nativeBuildVersion) return Application.nativeBuildVersion;
  const code = Constants.expoConfig?.android?.versionCode;
  return code != null ? String(code) : null;
}

function versionLabel(): string {
  const version = Constants.expoConfig?.version ?? 'unknown';
  const nativeBuild = resolveNativeBuild();
  return nativeBuild ? `${version} (build ${nativeBuild})` : version;
}

function FooterLink({ href, label, children }: {
  href: string | undefined; label: string; children?: React.ReactNode;
}): React.ReactElement {
  return (
    <Pressable
      disabled={!href}
      accessibilityRole="link"
      pressedOpacity={0.6}
      onPress={() => { if (href) capabilities.openUrl(href); }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
    >
      {children}
      <Text {...FOOTER_TEXT} style={href ? { textDecorationLine: 'underline' } : undefined}>{label}</Text>
    </Pressable>
  );
}

export function SettingsAboutFooter(): React.ReactElement {
  const { sub } = usePalette();
  const { gitHash: configuredHash, commitTime, buildProfile } = buildMeta();
  const devClient = devClientInfo();
  const gitHash = devClient?.gitHash ?? configuredHash;
  const committed = timeAgo(commitTime, Date.now());
  const shortHash = gitHash === 'dev' ? 'dev' : gitHash.slice(0, 7);
  const name = Constants.expoConfig?.name ?? 'Stage';
  return (
    <Col padding={{ x: PAGE_GUTTER, y: 18 }} align="center" gap={4}>
      <Text {...FOOTER_TEXT} style={{ textAlign: 'center' }}>
        {`${name} ${versionLabel()} · ${buildProfile}`}
      </Text>
      <Row align="center" justify="center" gap={4} wrap>
        <FooterLink href={commitUrl(gitHash)} label={devClient ? `Loaded ${shortHash}` : shortHash} />
        <Text {...FOOTER_TEXT}>·</Text>
        <Text {...FOOTER_TEXT}>{committed.length > 0 ? committed : '-'}</Text>
        <Text {...FOOTER_TEXT}>·</Text>
        <FooterLink href={STAGE_GITHUB_URL} label="bonustrack/stage">
          <GithubLogo size={GITHUB_ICON_SIZE} color={sub} />
        </FooterLink>
      </Row>
      <DevClientUpdate />
    </Col>
  );
}
