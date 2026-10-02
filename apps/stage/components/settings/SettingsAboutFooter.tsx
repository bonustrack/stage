import { useRef, useState } from 'react';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { errorMessage } from '@stage-labs/client/errors';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col, Row, PAGE_GUTTER } from '../layout';
import { GithubLogo } from '../bubble/linkCards';
import { openInBubbleLink } from '../../lib/safeOpenLink';
import { bubbleLinkProps } from '../bubble/linkProps';
import { usePalette } from '../../lib/theme';
import { timeAgo } from '../../lib/buildInfo.model';
import { capabilities } from '../../lib/capabilities';
import { checkMainUpdate, devClientInfo, loadMainUpdate } from '../../lib/devClientUpdates';
import { report } from '../../lib/errorPolicy';
import { mainUpdateMessage } from './DevClientUpdate.model';

const STAGE_GITHUB_URL = 'https://github.com/bonustrack/stage';

function commitUrl(gitHash: string): string | undefined {
  return gitHash === 'dev' || gitHash.length === 0 ? undefined : `${STAGE_GITHUB_URL}/commit/${gitHash}`;
}

interface BuildMeta {
  gitHash: string; commitTime: string; buildProfile: string;
}

function extraString(extra: Record<string, unknown>, key: string, fallback: string): string {
  const v = extra[key];
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function buildMeta(): BuildMeta {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  return {
    gitHash: extraString(extra, 'gitHash', 'dev'),
    commitTime: extraString(extra, 'commitTime', ''),
    buildProfile: extraString(extra, 'buildProfile', 'dev'),
  };
}

const FOOTER_TEXT = { role: 'secondary', variant: 'caption', size: '3xs', weight: 'medium' } as const;
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
      {...(href ? bubbleLinkProps(href, openInBubbleLink) : {})}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
    >
      {children}
      <Text {...FOOTER_TEXT} style={href ? { textDecorationLine: 'underline' } : undefined}>{label}</Text>
    </Pressable>
  );
}

function DevClientUpdate(): React.ReactElement | null {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const info = devClientInfo();
  if (!info) return null;

  async function refresh(): Promise<void> {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setStatus('Checking main with this APK runtime…');
    try {
      const update = await checkMainUpdate();
      const needsApk = update.runtime !== update.latest.runtime;
      setStatus(needsApk ? `Latest main ${update.latest.gitHash.slice(0, 7)} needs a new APK. Compatible main: ${update.gitHash.slice(0, 7)}.` : `Compatible main: ${update.gitHash.slice(0, 7)}.`);
      const confirmed = await capabilities.confirm({
        title: needsApk ? 'New dev-client APK required for latest main' : 'Load main update',
        message: mainUpdateMessage(update, info?.gitHash ?? null),
        confirmLabel: 'Reload compatible update',
      });
      if (confirmed) {
        setStatus(`Loading compatible main ${update.gitHash.slice(0, 7)}…`);
        await loadMainUpdate(update);
      }
    } catch (err) {
      report('devClient.mainUpdate', err);
      setStatus(errorMessage(err));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <Col align="center" gap={4}>
      <Pressable accessibilityRole="button" onPress={() => { capabilities.copy('Loaded runtime and update', `Runtime: ${info.runtime ?? 'unknown'}\nUpdate: ${info.updateId ?? 'local development'}`); }}>
        <Text {...FOOTER_TEXT}>{`Runtime ${info.runtime?.slice(0, 8) ?? 'unknown'} · Update ${info.updateId?.slice(0, 8) ?? 'local'}`}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy || !info.runtime} onPress={() => { void refresh(); }} pressedOpacity={0.6}>
        <Text {...FOOTER_TEXT} color="link" style={{ textDecorationLine: 'underline' }}>{busy ? 'Checking main…' : 'Load main update'}</Text>
      </Pressable>
      {status ? <Text {...FOOTER_TEXT} style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">{status}</Text> : null}
      {!info.runtime ? <Text {...FOOTER_TEXT}>This dev client has no known native runtime.</Text> : null}
      <Pressable accessibilityRole="link" {...bubbleLinkProps('https://bundler.stage.box/', openInBubbleLink)} pressedOpacity={0.6}>
        <Text {...FOOTER_TEXT} color="link" style={{ textDecorationLine: 'underline' }}>Dev-client downloads</Text>
      </Pressable>
    </Col>
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
