
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { Box, Col, Row, PAGE_GUTTER } from '../layout';
import {
  listXmtpInstallations, revokeXmtpInstallation, shortAddress, useActiveAccount,
  type XmtpInstallation,
} from '../../modules/messaging';
import { capabilities } from '../../lib/capabilities';
import { DANGER, usePalette } from '../../lib/theme';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';

function when(ms: number | undefined): string {
  if (!ms) return 'Unknown date';
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Session({ inst, busy, onRevoke }: {
  inst: XmtpInstallation; busy: boolean; onRevoke: () => void;
}): React.ReactElement {
  const { text: fg, border } = usePalette();
  return (
    <Box
      radius={BLOCK_RADIUS_DEFAULT}
      margin={{ x: PAGE_GUTTER, top: 8 }}
      padding={12}
      background={border}
      style={{ borderWidth: 1, borderColor: border }}
    >
      <Row align="center" gap={12}>
        <Icon name="deviceTablet" size={24} color={fg} />
        <Col flex={1} minWidth={0}>
          <Row align="center" gap={8}>
            <Text size="md" color={fg}>{shortAddress(inst.id)}</Text>
            {inst.current ? (
              <Text size="xs" role="success" style={{ textTransform: 'uppercase' }}>This device</Text>
            ) : null}
          </Row>
          <Text size="xs" color={fg} style={{ marginTop: 2 }}>Added {when(inst.createdAt)}</Text>
        </Col>
        <Pressable onPress={onRevoke} disabled={busy} hitSlop={8} style={{ padding: 4, opacity: busy ? 0.4 : 1 }}>
          {busy ? <ActivityIndicator size="small" color={DANGER} /> : <Text size="sm" color={DANGER}>Revoke</Text>}
        </Pressable>
      </Row>
    </Box>
  );
}

export function MessengerSessions(): React.ReactElement {
  const { text: fg } = usePalette();
  const epoch = useActiveAccount();
  const [list, setList] = useState<XmtpInstallation[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setError(false);
    try { setList(await listXmtpInstallations()); }
    catch { setList([]); setError(true); }
  }, []);

  useEffect(() => { void load(); }, [load, epoch]);

  const revoke = (inst: XmtpInstallation): void => {
    Alert.alert(
      inst.current ? 'Revoke this device?' : 'Revoke session',
      inst.current
        ? 'This is the device you are using. Revoking it logs this device out of messaging; you will need to set up XMTP again here.'
        : `Revoke the session ${shortAddress(inst.id)}? That device will lose access to this inbox.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke', style: 'destructive', onPress: () => {
            setBusy(inst.id);
            void revokeXmtpInstallation(inst.id)
              .then(() => { capabilities.toast('Session revoked'); return load(); })
              .catch(() => { Alert.alert('Revoke failed', 'Could not revoke that session. Check your connection and try again.'); })
              .finally(() => { setBusy(null); });
          },
        },
      ],
    );
  };

  return (
    <Col>
      <Text size="xs" color={fg} style={{ paddingHorizontal: PAGE_GUTTER, paddingTop: 28 }}>
        ACTIVE SESSIONS
      </Text>
      {list === null ? (
        <Row padding={{ x: PAGE_GUTTER, top: 12 }} gap={8} align="center">
          <Spinner size={20} color={fg} />
          <Text size="sm" color={fg}>Loading sessions…</Text>
        </Row>
      ) : error ? (
        <Text size="sm" color={fg} style={{ paddingHorizontal: PAGE_GUTTER, paddingTop: 12 }}>
          Messaging isn{'’'}t ready yet. Open a chat first, then come back.
        </Text>
      ) : list.length === 0 ? (
        <Text size="sm" color={fg} style={{ paddingHorizontal: PAGE_GUTTER, paddingTop: 12 }}>
          No active sessions.
        </Text>
      ) : (
        list.map(inst => (
          <Session key={inst.id} inst={inst} busy={busy === inst.id} onRevoke={() => { revoke(inst); }} />
        ))
      )}
    </Col>
  );
}
