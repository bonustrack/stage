/** Account-security section of the Settings tab: "Export private key" and
 *  "Remove account" rows for the ACTIVE account. Both gate behind a warning
 *  Alert. Export reuses getPrivateKey (self-heals legacy keys); remove reuses
 *  deleteAccount (drops the registry entry, the SecureStore key + the on-disk
 *  XMTP store). The key is never logged. */

import { useEffect, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Col } from '../layout';
import { flash } from '../../lib/toast';
import {
  getActiveAccount, getPrivateKey, canExportPrivateKey, type AccountRecord,
} from '../../lib/accounts';
import { deleteAccount, shortAddress } from '../../lib/xmtp';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { reloadApp } from '../AccountsManager.helpers';

interface SectionColors { fg: string; head: string; sub: string; border: string; rowBg: string }

export function AccountSecuritySection(
  { c, danger }: { c: SectionColors; danger: string },
): React.ReactElement | null {
  const epoch = useAccountEpoch();
  const [rec, setRec] = useState<AccountRecord | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async (): Promise<void> => {
      const active = await getActiveAccount();
      if (alive) { setRec(active); setRevealed(null); }
    })();
    return () => { alive = false; };
  }, [epoch]);

  if (!rec) return null;
  const exportable = canExportPrivateKey(rec);

  function confirmExport(): void {
    Alert.alert(
      'Export private key',
      'Anyone with this key controls your account — never share it. Make sure no one can see your screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reveal key', style: 'destructive', onPress: () => {
            void (async (): Promise<void> => {
              const id = rec?.id;
              if (!id) return;
              const pk = await getPrivateKey(id);
              if (!pk) { Alert.alert('No key', 'This account has no exportable private key.'); return; }
              setRevealed(pk);
            })();
          } },
      ],
    );
  }

  function confirmRemove(): void {
    const name = rec?.label ?? shortAddress(rec?.address ?? '');
    Alert.alert(
      'Remove account',
      `Remove ${name}? Without the private key backed up this account is unrecoverable — its local XMTP database is deleted from this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => {
            void (async (): Promise<void> => {
              const id = rec?.id;
              if (!id) return;
              await deleteAccount(id);
              reloadApp();
            })();
          } },
      ],
    );
  }

  return (
    <>
      <Text style={{ color: c.sub, fontSize: 13, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8, fontFamily: 'Calibre-Medium' }}>
        ACCOUNT
      </Text>
      <Col mx={16} radius={12} bg={c.rowBg} style={{ overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
        {exportable ? (
          <Pressable
            onPress={revealed ? () => { void Clipboard.setStringAsync(revealed); flash('Private key copied'); } : confirmExport}
            style={({ pressed }) => ({
              paddingHorizontal: 14, paddingVertical: 14,
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: pressed ? c.border : 'transparent',
            })}
          >
            <Icon name="wallet" size={22} color={c.head} />
            <Col flex={1}>
              <Text style={{ color: c.fg, fontSize: 18, fontFamily: 'Calibre-Medium' }}>
                {revealed ? 'Tap to copy private key' : 'Export private key'}
              </Text>
              {revealed ? (
                <Text selectable style={{ color: c.sub, fontSize: 12, marginTop: 4, fontFamily: 'Calibre-Medium' }}>
                  {revealed}
                </Text>
              ) : null}
            </Col>
            <Icon name={revealed ? 'copy' : 'chevronDown'} size={20} color={c.head} />
          </Pressable>
        ) : null}

        <Pressable
          onPress={confirmRemove}
          style={({ pressed }) => ({
            paddingHorizontal: 14, paddingVertical: 14,
            flexDirection: 'row', alignItems: 'center', gap: 12,
            borderTopWidth: exportable ? 1 : 0, borderTopColor: c.border,
            backgroundColor: pressed ? c.border : 'transparent',
          })}
        >
          <Icon name="trash" size={22} color={danger} />
          <Text style={{ color: danger, fontSize: 18, fontFamily: 'Calibre-Medium', flex: 1 }}>
            Remove account
          </Text>
        </Pressable>
      </Col>
    </>
  );
}
