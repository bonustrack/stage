import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Title } from '@stage-labs/kit/react-native/title';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row, Col } from '../layout';
import { usePalette } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { buildMeta, commitUrl, STAGE_GITHUB_URL } from '../../lib/githubRepo';
import { timeAgo } from '../../lib/buildInfo.model';
import { SettingsPage } from '../settings/SettingsPage';
import { SettingsList, SettingsValueRow } from '../settings/rows';
import { GithubLogo } from '../GithubLogo';

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

function GitHubLinkRow(): React.ReactElement {
  const { text, link: head, border } = usePalette();
  return (
    <Pressable
      onPress={() => { capabilities.openUrl(STAGE_GITHUB_URL); }}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
>
      <Box radius="lg" surface="raised" padding={{ x: 14, y: 14 }} margin={{ x: 16, top: 16 }}
        style={{ borderWidth: 1, borderColor: border }}
>
        <Row gap={12} align="center">
          <GithubLogo size={24} color={head}/>
          <Col flex={1}>
            <Text weight="semibold" size="md" color={head}>View Stage on GitHub</Text>
            <Text role="secondary" variant="caption" weight="medium" style={{ marginTop: 2 }}>bonustrack/stage</Text>
          </Col>
          <Icon name="externalLink" size={18} color={text}/>
        </Row>
      </Box>
    </Pressable>
  );
}

export function AboutPage(): React.ReactElement {
  const { link: head } = usePalette();
  const { gitHash, commitTime, buildProfile } = buildMeta();
  const committed = timeAgo(commitTime, Date.now());
  const shortHash = gitHash === 'dev' ? 'dev' : gitHash.slice(0, 12);
  const commitHref = commitUrl(gitHash);

  return (
    <SettingsPage title="About">
      <Box padding={{ top: 18 }}>
        <Box padding={{ x: 16 }}>
          <Title level={2} color={head}>About</Title>
          <Text variant="secondary" weight="medium" size="xs" style={{ marginTop: 4, marginBottom: 8 }}>
            Build + runtime metadata for this install.
          </Text>
        </Box>
        <SettingsList>
          <SettingsValueRow label="App" value={Constants.expoConfig?.name ?? 'Stage'} />
          <SettingsValueRow label="Version" value={versionLabel()} />
          <SettingsValueRow
            label="Commit"
            value={shortHash}
            onPress={commitHref ? () => { capabilities.openUrl(commitHref); } : undefined}
          />
          <SettingsValueRow label="Committed" value={committed.length > 0 ? committed : '-'} />
          <SettingsValueRow label="Build profile" value={buildProfile} />
        </SettingsList>
        <Box padding={{ x: 16 }}>
          <Text role="secondary" variant="caption" weight="medium" style={{ marginTop: 14 }}>
            Commit shows "dev" only when the build could not resolve a git SHA. Tap it to open the commit on GitHub.
          </Text>
        </Box>
        <GitHubLinkRow />
      </Box>
    </SettingsPage>
  );
}
