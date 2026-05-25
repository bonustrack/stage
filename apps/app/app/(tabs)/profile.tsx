/** Profile tab — wallet identity + Snapshot-hub profile (display name, bio,
 *  custom avatar, socials). Tap Edit to open the EIP-712 update sheet. */

import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getOrCreateXmtpClient, shortAddress } from '../../lib/xmtp';
import { useEffectiveColorScheme } from '../../lib/theme';
import { usePushToken, type PushStatus } from '../../lib/push';
import {
  loadCachedProfile, readProfile, type SnapshotProfile,
} from '../../lib/profile';
import { avatarRenderUrl } from '../../../_shared/profile/snapshot';
import EditProfileModal from '../../components/EditProfileModal';

const AVATAR_SIZE = 120;

export default function Profile(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#000000' : '#ffffff';
  const border = dark ? '#262c38' : '#e3e7ef';
  const rowBg = dark ? '#161a22' : '#fafbfd';

  const [address, setAddress] = useState<string>('');
  const [inboxId, setInboxId] = useState<string>('');
  const [profile, setProfile] = useState<SnapshotProfile>({});
  const [editing, setEditing] = useState(false);
  const push = usePushToken();

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        const addr = client.publicIdentity.identifier;
        setAddress(addr);
        setInboxId(client.inboxId);
        /** Local cache first so the UI doesn't flash a blank state on cold start;
         *  the hub fetch then promotes the canonical record. */
        const cached = await loadCachedProfile();
        if (cached) setProfile(cached);
        const remote = await readProfile(addr);
        if (remote) setProfile(remote);
      } catch { /* leave fields blank — render placeholder */ }
    })();
  }, []);

  const copy = (value: string, label: string): void => {
    void Clipboard.setStringAsync(value);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  const displayName = profile.name?.trim() || shortAddress(address);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: fg, fontSize: 22, fontFamily: 'Calibre-Semibold' }}>Profile</Text>
        {address ? (
          <Pressable onPress={() => setEditing(true)} hitSlop={8}>
            <Text style={{ color: fg, fontSize: 14, fontFamily: 'Calibre-Semibold' }}>Edit</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 16 }}>
        {address ? (
          <Image
            source={{ uri: avatarRenderUrl(address, profile.avatar, AVATAR_SIZE * 2) }}
            style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: rowBg }}
          />
        ) : (
          <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: rowBg }} />
        )}
        <Text style={{ color: fg, fontSize: 18, fontFamily: 'Calibre-Semibold', marginTop: 14 }}>
          {address ? displayName : 'Loading…'}
        </Text>
        {profile.about ? (
          <Text style={{ color: sub, fontSize: 13, marginTop: 6, paddingHorizontal: 24, textAlign: 'center' }}>
            {profile.about}
          </Text>
        ) : null}
      </View>

      {address ? (
        <Pressable
          onPress={() => copy(address, 'Wallet address')}
          style={{ marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: rowBg, borderWidth: 1, borderColor: border }}
        >
          <Text style={{ color: sub, fontSize: 11 }}>WALLET ADDRESS (tap to copy)</Text>
          <Text style={{ color: fg, fontSize: 13, marginTop: 4 }}>{address}</Text>
        </Pressable>
      ) : null}

      {inboxId ? (
        <Pressable
          onPress={() => copy(inboxId, 'XMTP inbox id')}
          style={{ marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: rowBg, borderWidth: 1, borderColor: border }}
        >
          <Text style={{ color: sub, fontSize: 11 }}>XMTP INBOX ID (tap to copy)</Text>
          <Text style={{ color: fg, fontSize: 13, marginTop: 4 }} numberOfLines={1}>{inboxId}</Text>
        </Pressable>
      ) : null}

      <PushTokenCard status={push.status} token={push.token} error={push.error}
        onCopy={() => push.token && copy(push.token, 'FCM device token')}
        sub={sub} fg={fg} border={border} rowBg={rowBg} />

      <EditProfileModal
        visible={editing} onClose={() => setEditing(false)}
        onSaved={next => setProfile(next)}
        address={address} initial={profile} dark={dark}
      />
    </View>
  );
}

function PushTokenCard({ status, token, error, onCopy, sub, fg, border, rowBg }: {
  status: PushStatus; token: string | null; error: string | null; onCopy: () => void;
  sub: string; fg: string; border: string; rowBg: string;
}): React.ReactElement {
  const label = status === 'requesting' ? 'PUSH TOKEN (requesting permission…)'
    : status === 'denied' ? 'PUSH TOKEN (permission denied — enable in system settings)'
    : status === 'unavailable' ? 'PUSH TOKEN (no Play Services / not a real device)'
    : status === 'error' ? `PUSH TOKEN (error: ${error ?? 'unknown'})`
    : 'PUSH TOKEN (tap to copy)';
  const showSubtitle = status !== 'ready';
  const body = token ?? (showSubtitle ? 'Run `metro call xmtp register-push \'{"token":"…"}\'` on the daemon host after copying.' : '');

  return (
    <Pressable
      onPress={token ? onCopy : undefined}
      style={{
        marginHorizontal: 16, marginTop: 12, padding: 12,
        borderRadius: 12, backgroundColor: rowBg,
        borderWidth: 1, borderColor: border,
        opacity: status === 'ready' ? 1 : 0.7,
      }}
    >
      <Text style={{ color: sub, fontSize: 11 }}>{label}</Text>
      {body ? (
        <Text style={{ color: fg, fontSize: 11, marginTop: 4 }}
          numberOfLines={token ? 3 : undefined} selectable>
          {body}
        </Text>
      ) : null}
    </Pressable>
  );
}
