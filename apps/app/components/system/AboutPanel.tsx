/**
 * @file About panel for the System screen showing app version, git commit hash,
 *  package name, and build profile, with the commit row linking through to the
 *  GitHub commit when a real SHA is stamped at build time.
 */

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

/** The About Row component. */
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

/** Resolved build + runtime metadata shown in the About panel. */
interface AboutMeta {
  pkgName: string; versionLabel: string; gitHash: string; shortHash: string; buildProfile: string;
}

/** Read a non-empty string from the Expo config `extra` map, or a fallback. */
function extraString(extra: Record<string, unknown>, key: string, fallback: string): string {
  const v = extra[key];
  return typeof v === 'string' && v.length> 0 ? v : fallback;
}

/** Resolve the native build version string, or null when unavailable. */
function resolveNativeBuild(): string | null {
  if (Application.nativeBuildVersion) return Application.nativeBuildVersion;
  const code = Constants.expoConfig?.android?.versionCode;
  return code != null ? String(code) : null;
}

/** Resolve app/version/commit/build metadata from the Expo config + native build version. */
function resolveAboutMeta(): AboutMeta {
  const cfg = Constants.expoConfig;
  const version = cfg?.version ?? 'unknown';
  const extra = (cfg?.extra ?? {}) as Record<string, unknown>;
  const gitHash = extraString(extra, 'gitHash', 'dev');
  const nativeBuild = resolveNativeBuild();
  return {
    pkgName: cfg?.name ?? 'Stage',
    versionLabel: nativeBuild ? `${version} (build ${nativeBuild})` : version,
    gitHash,
    shortHash: gitHash === 'dev' ? 'dev' : gitHash.slice(0, 12),
    buildProfile: extraString(extra, 'buildProfile', 'dev'),
  };
}

/** Renders the About panel showing app version and build metadata. */
export function AboutPanel({ dark, head, sub, border, rowBg }: {
  dark: boolean; head: string; sub: string; border: string; rowBg: string;
}): React.ReactElement {
  const { pkgName, versionLabel, gitHash, shortHash, buildProfile } = resolveAboutMeta();

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
        title="View Stage on GitHub"
        subtitle="bonustrack/stage"
      />
    </Box>
  );
}
