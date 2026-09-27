import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Text } from '@stage-labs/kit/react-native/text';
import { Row, PAGE_GUTTER } from '../layout';
import { StageMark } from '../landing/StageLogo';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import { buildMeta, commitUrl, STAGE_GITHUB_URL } from '../../lib/githubRepo';
import { timeAgo } from '../../lib/buildInfo.model';

const FOOTER_LOGO_SIZE = 24;
const FOOTER_TEXT = { role: 'secondary', variant: 'caption', size: 'sm', weight: 'medium' } as const;

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

function FooterLink({ href, label }: { href: string | undefined; label: string }): React.ReactElement {
  return (
    <Text {...FOOTER_TEXT} onPress={href ? () => { capabilities.openUrl(href); } : undefined}>
      {label}
    </Text>
  );
}

export function SettingsAboutFooter(): React.ReactElement {
  const { link: head } = usePalette();
  const { gitHash, commitTime, buildProfile } = buildMeta();
  const committed = timeAgo(commitTime, Date.now());
  const shortHash = gitHash === 'dev' ? 'dev' : gitHash.slice(0, 12);
  const name = Constants.expoConfig?.name ?? 'Stage';
  return (
    <Row padding={{ x: PAGE_GUTTER, y: 18 }} align="center" justify="center" gap={8}>
      <StageMark size={FOOTER_LOGO_SIZE} color={head} />
      <Text {...FOOTER_TEXT} numberOfLines={1} style={{ flexShrink: 1 }}>
        {`${name} ${versionLabel()} · ${buildProfile} · `}
        <FooterLink href={commitUrl(gitHash)} label={shortHash} />
        {` · ${committed.length > 0 ? committed : '-'} · `}
        <FooterLink href={STAGE_GITHUB_URL} label="bonustrack/stage on GitHub" />
      </Text>
    </Row>
  );
}
