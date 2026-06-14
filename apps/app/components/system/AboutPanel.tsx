/** About panel for the System screen: app version, git commit hash, package
 *  name + build profile. Version comes from expo Constants (app.config version);
 *  the git hash is injected at build time into `extra.gitHash` (EAS sets
 *  EAS_BUILD_GIT_COMMIT_HASH on cloud builds, the PR-preview Action sets
 *  GIT_COMMIT, and local builds fall back to `git rev-parse`). The Commit row is
 *  tappable through to the GitHub commit when a real SHA is stamped. */

import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Linking } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Box, Row } from '../layout';
import { Title } from '@metro-labs/kit/title';
import { Text } from '@metro-labs/kit/text';
import { GitHubLinkRow } from './GitHubLinkRow';

const METRO_GITHUB_URL = 'https://github.com/bonustrack/stage';

interface AboutRowProps {
  label: string; value: string; mono?: boolean; dark: boolean; border: string;
  href?: string; head?: string;
}

function AboutRow({ label, value, mono, border, href, head }: AboutRowProps): React.ReactElement {
  const valueColor = href ? head : undefined;
  const row = (
    <Row padding={{ y: 14 }} align="center" justify="between" gap={16} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <Text variant="secondary" weight="medium" size="md">{label}</Text>
      <Text
       
        variant={mono ? 'mono' : 'body'}
        weight="semibold"
        size="md"
        numberOfLines={1}
        color={valueColor}
      >
        {value}
      </Text>
    </Row>
  );
  if (!href) return row;
  return (
    <Pressable
      onPress={() => { void Linking.openURL(href); }}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {row}
    </Pressable>
  );
}

export function AboutPanel({ dark, head, sub, border, rowBg }: {
  dark: boolean; head: string; sub: string; border: string; rowBg: string;
}): React.ReactElement {
  const cfg = Constants.expoConfig;
  const version = cfg?.version ?? 'unknown';
  const extra = (cfg?.extra ?? {}) as { gitHash?: unknown; buildProfile?: unknown };
  const gitHash = typeof extra.gitHash === 'string' && extra.gitHash.length> 0 ? extra.gitHash : 'dev';
  const shortHash = gitHash === 'dev' ? 'dev' : gitHash.slice(0, 12);
  const buildProfile = typeof extra.buildProfile === 'string' && extra.buildProfile.length> 0
    ? extra.buildProfile : 'dev';
  const pkgName = cfg?.name ?? 'Metro';
  const nativeBuild = Application.nativeBuildVersion
    ?? (Constants.expoConfig?.android?.versionCode != null
      ? String(Constants.expoConfig.android.versionCode) : null);
  const versionLabel = nativeBuild ? `${version} (build ${nativeBuild})` : version;

  return (
    <Box padding={{ top: 18 }}>
      <Box padding={{ x: 16 }}>
      <Title level={2} color={head}>About</Title>
      <Text variant="secondary" weight="medium" size="xs" style={{ marginTop: 4, marginBottom: 8 }}>
        Build + runtime metadata for this install.
      </Text>
      <AboutRow label="App" value={pkgName} dark={dark} border={border} />
      <AboutRow label="Version" value={versionLabel} dark={dark} border={border} />
      <AboutRow
        label="Commit" value={shortHash} mono dark={dark} border={border}
        href={gitHash === 'dev' ? undefined : `${METRO_GITHUB_URL}/commit/${gitHash}`}
        head={head}
      />
      <AboutRow label="Build profile" value={buildProfile} dark={dark} border={border} />
      <Text color={sub} variant="caption" weight="medium" style={{ marginTop: 14 }}>
        Commit shows "dev" only when the build could not resolve a git SHA. Tap it to open the commit on GitHub.
      </Text>
      </Box>
      <GitHubLinkRow
        dark={dark} head={head} sub={sub} border={border} rowBg={rowBg}
        url={METRO_GITHUB_URL}
        title="View Metro on GitHub"
        subtitle="bonustrack/stage"
      />
    </Box>
  );
}
