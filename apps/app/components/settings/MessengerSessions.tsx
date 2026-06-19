/** Settings -> Messenger -> Sessions - lists the active XMTP inbox's
 *  installations (devices), newest first, with the current device flagged, and a
 *  per-row "Revoke" that kills that installation. Revoke confirms via Alert
 *  (with a stronger warning for the current device, since revoking it logs this
 *  device out), signs through the active account's keyring-backed signer, then
 *  refreshes the list. All data comes from the live inbox state; no invented
 *  fields. Handles client-not-ready / empty / revoke-failure without crashing. */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Pressable } from '@metro-labs/kit/pressable';
import { Box, Col, Row } from '../layout';
import {
  listXmtpInstallations, revokeXmtpInstallation, shortAddress, useActiveAccount,
  type XmtpInstallation,
} from '../../modules/messaging';
import { flash } from '../../lib/toast';
import { DANGER, useBlockRadius, usePalette } from '../../lib/theme';

/** When helper. */
function when(ms: number | undefined): string {
  if (!ms) return 'Unknown date';
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** The Session component. */
function Session({ inst, busy, onRevoke, c }: {
  inst: XmtpInstallation; busy: boolean; onRevoke: () => void;
  c: { fg: string; sub: string; border: string; rowBg: string };
}): React.ReactElement {
  const blockRadius = useBlockRadius();
  return (
    <Box
      radius={blockRadius}
      margin={{ x: 16, top: 8 }}
      padding={12}
      background={c.rowBg}
      style={{ borderWidth: 1, borderColor: c.border }}
    >
      <Row align="center" gap={12}>
        <Icon name="deviceTablet" size={22} color={c.fg} />
        <Col flex={1} minWidth={0}>
          <Row align="center" gap={8}>
            <Text size="md" color={c.fg}>{shortAddress(inst.id)}</Text>
            {inst.current ? (
              <Text size="xs" role="success" style={{ textTransform: 'uppercase' }}>This device</Text>
            ) : null}
          </Row>
          <Text size="xs" color={c.sub} style={{ marginTop: 2 }}>Added {when(inst.createdAt)}</Text>
        </Col>
        <Pressable onPress={onRevoke} disabled={busy} hitSlop={8} style={{ padding: 4, opacity: busy ? 0.4 : 1 }}>
          {busy ? <ActivityIndicator size="small" color={DANGER} /> : <Text size="sm" color={DANGER}>Revoke</Text>}
        </Pressable>
      </Row>
    </Box>
  );
}

/** Renders the messenger sessions screen listing the account's active sessions. */
export function MessengerSessions(): React.ReactElement {
  const { text: fg, border } = usePalette();
  const c = { fg, sub: fg, border, rowBg: border };
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

  /** Revoke helper. */
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
              .then(() => { flash('Session revoked'); return load(); })
              .catch(() => { Alert.alert('Revoke failed', 'Could not revoke that session. Check your connection and try again.'); })
              .finally(() => { setBusy(null); });
          },
        },
      ],
    );
  };

  return (
    <Col>
      <Text size="xs" color={c.sub} style={{ paddingHorizontal: 16, paddingTop: 28 }}>
        ACTIVE SESSIONS
      </Text>
      {list === null ? (
        <Row padding={{ x: 16, top: 12 }} gap={8} align="center">
          <ActivityIndicator size="small" color={fg} />
          <Text size="sm" color={c.sub}>Loading sessions…</Text>
        </Row>
      ) : error ? (
        <Text size="sm" color={c.sub} style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          Messaging isn{'’'}t ready yet — open a chat first, then come back.
        </Text>
      ) : list.length === 0 ? (
        <Text size="sm" color={c.sub} style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          No active sessions.
        </Text>
      ) : (
        list.map(inst => (
          <Session key={inst.id} inst={inst} busy={busy === inst.id} onRevoke={() => { revoke(inst); }} c={c} />
        ))
      )}
    </Col>
  );
}
