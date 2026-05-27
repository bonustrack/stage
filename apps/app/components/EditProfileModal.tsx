/** Edit-profile sheet: avatar picker + name / about / social handle inputs.
 *  Signs an EIP-712 envelope and POSTs it to the Snapshot sequencer via
 *  `lib/profile.ts`. Closes on success and emits the new profile so the parent
 *  refreshes immediately. */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  type SnapshotProfile, updateProfile, uploadAvatar,
} from '../lib/profile';
import { PROFILE_FIELD_LIMITS, getCacheHash } from '../../_shared/profile/snapshot';
import { stampBoxAvatarUrl } from '../lib/xmtp';

const AVATAR_SIZE = 96;

interface Field { key: keyof SnapshotProfile; label: string; placeholder: string; multiline?: boolean }
const FIELDS: Field[] = [
  { key: 'name', label: 'Name', placeholder: 'Display name' },
  { key: 'about', label: 'About', placeholder: 'Tell your story', multiline: true },
  { key: 'github', label: 'GitHub', placeholder: 'GitHub handle' },
  { key: 'twitter', label: 'X (Twitter)', placeholder: 'X handle' },
  { key: 'lens', label: 'Lens', placeholder: 'Lens handle' },
  { key: 'farcaster', label: 'Farcaster', placeholder: 'Farcaster handle' },
];

export default function EditProfileModal({
  visible, onClose, onSaved, address, initial, dark,
}: {
  visible: boolean; onClose: () => void;
  onSaved: (next: SnapshotProfile) => void;
  address: string; initial: SnapshotProfile; dark: boolean;
}): React.ReactElement {
  const fg = dark ? '#9f9fa3' : '#57606a';
  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const rowBg = dark ? '#282a2d' : '#e4e4e5';
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<SnapshotProfile>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** Re-seed the form whenever the parent reopens us with a fresh `initial`. */
  useEffect(() => { if (visible) setForm(initial); }, [visible, initial]);

  const pickAvatar = async (): Promise<void> => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', quality: 0.85, allowsMultipleSelection: false,
    });
    if (r.canceled || !r.assets?.length) return;
    const a = r.assets[0];
    setUploading(true);
    try {
      const url = await uploadAvatar(a.uri, a.mimeType ?? 'image/jpeg', a.fileName ?? 'avatar');
      setForm(prev => ({ ...prev, avatar: url }));
    } catch (e) { Alert.alert('Upload failed', (e as Error).message); }
    finally { setUploading(false); }
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      await updateProfile(form);
      onSaved(form);
      onClose();
    } catch (e) { Alert.alert('Save failed', (e as Error).message); }
    finally { setSaving(false); }
  };

  const update = <K extends keyof SnapshotProfile>(k: K, v: string): void => {
    const max = PROFILE_FIELD_LIMITS[k as keyof typeof PROFILE_FIELD_LIMITS];
    setForm(prev => ({ ...prev, [k]: max ? v.slice(0, max) : v }));
  };

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" transparent={false}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 12,
          borderBottomWidth: 1, borderBottomColor: border,
        }}>
          <Pressable onPress={onClose} disabled={saving}><Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium' }}>Cancel</Text></Pressable>
          <Text style={{ color: head, fontSize: 17, fontFamily: 'Calibre-Semibold' }}>Edit profile</Text>
          {/** Spacer to balance the row — Save sits at the bottom as a pill now. */}
          <View style={{ width: 50 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Pressable onPress={pickAvatar} disabled={uploading}>
              <Image
                source={{ uri: stampBoxAvatarUrl(address, AVATAR_SIZE * 2, getCacheHash(form.avatar)) }}
                style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: rowBg, opacity: uploading ? 0.5 : 1 }}
              />
              {uploading ? (
                <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={fg} />
                </View>
              ) : null}
            </Pressable>
            <Text style={{ color: sub, fontSize: 12, marginTop: 8, fontFamily: 'Calibre-Medium' }}>Tap to change avatar</Text>
          </View>

          {FIELDS.map(f => (
            <View key={f.key} style={{ marginBottom: 14 }}>
              <Text style={{ color: sub, fontSize: 11, marginBottom: 4, fontFamily: 'Calibre-Medium' }}>{f.label.toUpperCase()}</Text>
              <TextInput
                value={(form[f.key] ?? '') as string}
                onChangeText={t => update(f.key, t)}
                placeholder={f.placeholder}
                placeholderTextColor={sub}
                multiline={f.multiline}
                style={{
                  color: fg, backgroundColor: rowBg, borderColor: border, borderWidth: 1,
                  borderRadius: 12, padding: 12, fontSize: 14,
                  minHeight: f.multiline ? 80 : undefined,
                  textAlignVertical: f.multiline ? 'top' : 'center',
                }}
              />
            </View>
          ))}

          <Pressable
            onPress={() => { void save(); }}
            disabled={saving || uploading}
            style={({ pressed }) => ({
              marginTop: 16, paddingVertical: 14,
              backgroundColor: dark ? '#ffffff' : '#000000', borderRadius: 999,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.85 : (saving || uploading) ? 0.6 : 1,
            })}
          >
            <Text style={{ color: dark ? '#000000' : '#ffffff', fontSize: 16, fontFamily: 'Calibre-Medium' }}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
