import { useRef, useState } from 'react';
import { errorMessage } from '@stage-labs/client/errors';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from '../layout';
import { capabilities } from '../../lib/capabilities';
import { checkMainUpdate, devClientInfo, loadMainUpdate } from '../../lib/devClientUpdates';
import { report } from '../../lib/errorPolicy';
import { mainUpdateMessage } from './DevClientUpdate.model';
import { bubbleLinkProps } from '../bubble/linkProps';
import { openInBubbleLink } from '../../lib/safeOpenLink';

const COPY = { role: 'secondary', variant: 'caption', size: '3xs', weight: 'medium' } as const;

export function DevClientUpdate(): React.ReactElement | null {
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
        <Text {...COPY}>{`Runtime ${info.runtime?.slice(0, 8) ?? 'unknown'} · Update ${info.updateId?.slice(0, 8) ?? 'local'}`}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy || !info.runtime} onPress={() => { void refresh(); }} pressedOpacity={0.6}>
        <Text {...COPY} color="link" style={{ textDecorationLine: 'underline' }}>{busy ? 'Checking main…' : 'Load main update'}</Text>
      </Pressable>
      {status ? <Text {...COPY} style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">{status}</Text> : null}
      {!info.runtime ? <Text {...COPY}>This dev client has no known native runtime.</Text> : null}
      <Pressable accessibilityRole="link" {...bubbleLinkProps('https://bundler.stage.box/', openInBubbleLink)} pressedOpacity={0.6}>
        <Text {...COPY} color="link" style={{ textDecorationLine: 'underline' }}>Dev-client downloads</Text>
      </Pressable>
    </Col>
  );
}
