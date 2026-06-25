
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Linking } from 'react-native';
import { Box } from '../layout';
import { Title } from '@stage-labs/kit/react-native/title';
import { Text } from '@stage-labs/kit/react-native/text';
import { ChatKitRenderer } from '@stage-labs/kit/react-native/chatkit-renderer';
import type {
  ListViewNode,
  WidgetActionRegistry,
} from '@stage-labs/kit/chatkit';
import {
  settingsValueRow,
  SETTINGS_ACTION_PRESS,
} from '@stage-labs/views';
import { GitHubLinkRow } from './GitHubLinkRow';

const METRO_GITHUB_URL = 'https://github.com/bonustrack/stage';

interface AboutMeta {
  pkgName: string; versionLabel: string; gitHash: string; shortHash: string; buildProfile: string;
}

function extraString(extra: Record<string, unknown>, key: string, fallback: string): string {
  const v = extra[key];
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function resolveNativeBuild(): string | null {
  if (Application.nativeBuildVersion) return Application.nativeBuildVersion;
  const code = Constants.expoConfig?.android?.versionCode;
  return code != null ? String(code) : null;
}

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

export function AboutPanel({ dark, head, sub, border, rowBg }: {
  dark: boolean; head: string; sub: string; border: string; rowBg: string;
}): React.ReactElement {
  const { pkgName, versionLabel, gitHash, shortHash, buildProfile } = resolveAboutMeta();
  const commitUrl = gitHash === 'dev' ? undefined : `${METRO_GITHUB_URL}/commit/${gitHash}`;

  const node: ListViewNode = {
    type: 'ListView',
    children: [
      settingsValueRow({ label: 'App', value: pkgName }),
      settingsValueRow({ label: 'Version', value: versionLabel }),
      settingsValueRow({
        label: 'Commit',
        value: shortHash,
        copyType: commitUrl ? SETTINGS_ACTION_PRESS : undefined,
        payload: commitUrl ? { url: commitUrl } : undefined,
      }),
      settingsValueRow({ label: 'Build profile', value: buildProfile }),
    ],
  };

  const registry: WidgetActionRegistry = {
    [SETTINGS_ACTION_PRESS]: (action) => {
      const url = action.payload.url;
      if (typeof url === 'string') void Linking.openURL(url);
    },
  };

  return (
    <Box padding={{ top: 18 }}>
      <Box padding={{ x: 16 }}>
        <Title level={2} color={head}>About</Title>
        <Text variant="secondary" weight="medium" size="xs" style={{ marginTop: 4, marginBottom: 8 }}>
          Build + runtime metadata for this install.
        </Text>
      </Box>
      <ChatKitRenderer node={node} registry={registry}/>
      <Box padding={{ x: 16 }}>
        <Text role="secondary" variant="caption" weight="medium" style={{ marginTop: 14 }}>
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
