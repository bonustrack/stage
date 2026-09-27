import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, PAGE_GUTTER } from '../layout';
import { capabilities } from '../../lib/capabilities';
import { buildMeta, commitUrl, STAGE_GITHUB_URL } from '../../lib/githubRepo';
import { timeAgo } from '../../lib/buildInfo.model';

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

export function SettingsAboutFooter(): React.ReactElement {
  const { gitHash, commitTime, buildProfile } = buildMeta();
  const committed = timeAgo(commitTime, Date.now());
  const shortHash = gitHash === 'dev' ? 'dev' : gitHash.slice(0, 12);
  const commitHref = commitUrl(gitHash);
  const name = Constants.expoConfig?.name ?? 'Stage';
  return (
    <Box padding={{ x: PAGE_GUTTER, y: 18 }} align="center">
      <Text role="secondary" variant="caption" weight="medium" style={{ textAlign: 'center' }}>
        {`${name} ${versionLabel()} · ${buildProfile}`}
      </Text>
      <Pressable
        disabled={!commitHref}
        onPress={() => { if (commitHref) capabilities.openUrl(commitHref); }}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginTop: 2 })}
      >
        <Text role="secondary" variant="caption" weight="medium" style={{ textAlign: 'center' }}>
          {`${shortHash} · ${committed.length > 0 ? committed : '-'}`}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => { capabilities.openUrl(STAGE_GITHUB_URL); }}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginTop: 2 })}
      >
        <Text role="secondary" variant="caption" weight="medium" style={{ textAlign: 'center' }}>
          bonustrack/stage on GitHub
        </Text>
      </Pressable>
    </Box>
  );
}
