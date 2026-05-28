/** Profile tab — wallet identity + Snapshot-hub profile (display name, bio,
 *  custom avatar, socials). Tap Edit to open the EIP-712 update sheet. */

import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getOrCreateXmtpClient, shortAddress } from '../../lib/xmtp';
import { useEffectiveColorScheme } from '../../lib/theme';
import { usePushToken, type PushStatus } from '../../lib/push';
import {
  loadCachedProfile, readProfile, type SnapshotProfile,
} from '../../lib/profile';
import EditProfileModal from '../../components/EditProfileModal';
import { HeroIcon } from '../../components/HeroIcon';
import { Avatar } from '../../components/Avatar';

export default function Profile(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const fg = dark ? '#9f9fa3' : '#57606a';
  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const rowBg = dark ? '#282a2d' : '#e4e4e5';

  const [address, setAddress] = useState<string>('');
  const [inboxId, setInboxId] = useState<string>('');
  const [profile, setProfile] = useState<SnapshotProfile>({});
  const [loaded, setLoaded] = useState(false);
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
        setLoaded(true);
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
        <Text style={{ color: head, fontSize: 22, fontFamily: 'Calibre-Semibold' }}>Profile</Text>
        {address ? (
          <Pressable onPress={() => setEditing(true)} hitSlop={8}>
            <HeroIcon name="pencil" size={22} color={head} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 16 }}>
        <Avatar
          address={address && loaded ? address : null}
          imageUri={loaded ? profile.avatar : null}
          size="lg"
          style={{ backgroundColor: rowBg }}
        />
        <Text style={{ color: head, fontSize: 22, fontFamily: 'Calibre-Semibold', marginTop: 14 }}>
          {address ? displayName : 'Loading…'}
        </Text>
        {profile.about ? (
          <Text style={{ color: sub, fontSize: 14, marginTop: 6, paddingHorizontal: 24, textAlign: 'center', fontFamily: 'Calibre-Medium' }}>
            {profile.about}
          </Text>
        ) : null}
      </View>

      {address ? (
        <Pressable
          onPress={() => copy(address, 'Wallet address')}
          style={{ marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: rowBg, borderWidth: 1, borderColor: border }}
        >
          <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>WALLET ADDRESS (tap to copy)</Text>
          <Text style={{ color: fg, fontSize: 14, marginTop: 4, fontFamily: 'Calibre-Medium' }}>{address}</Text>
        </Pressable>
      ) : null}

      {inboxId ? (
        <Pressable
          onPress={() => copy(inboxId, 'XMTP inbox id')}
          style={{ marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: rowBg, borderWidth: 1, borderColor: border }}
        >
          <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>XMTP INBOX ID (tap to copy)</Text>
          <Text style={{ color: fg, fontSize: 14, marginTop: 4, fontFamily: 'Calibre-Medium' }} numberOfLines={1}>{inboxId}</Text>
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
      <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>{label}</Text>
      {body ? (
        <Text style={{ color: fg, fontSize: 12, marginTop: 4, fontFamily: 'Calibre-Medium' }}
          numberOfLines={token ? 3 : undefined} selectable>
          {body}
        </Text>
      ) : null}
    </Pressable>
  );
}
