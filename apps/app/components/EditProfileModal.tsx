/** Edit-profile sheet: avatar picker + name / about / social handle inputs.
 *  Signs an EIP-712 envelope and POSTs it to the Snapshot sequencer via
 *  `lib/profile.ts`. Closes on success and emits the new profile so the parent
 *  refreshes immediately. */

import { useEffect, useState } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Alert, KeyboardAvoidingView, Modal, Platform } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { Input } from '@metro-labs/kit/input';
import { Textarea } from '@metro-labs/kit/textarea';
import { Avatar } from './Avatar';
import { Text } from '@metro-labs/kit/text';
import { Box } from './layout';
import { Button } from '@metro-labs/kit/button';
import { Spinner } from './Spinner';
import { Icon } from '@metro-labs/kit/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  type SnapshotProfile, updateProfile, uploadAvatar,
} from '../lib/profile';
import { PROFILE_FIELD_LIMITS, getCacheHash } from '@stage-labs/client/profile/snapshot';
import { setPeerProfile } from '../lib/peerProfiles';
import { usePalette, useBlockRadius } from '../lib/theme';

const AVATAR_SIZE = 96;

interface Field { key: keyof SnapshotProfile; label: string; placeholder: string; multiline?: boolean }
const FIELDS: Field[] = [
  { key: 'name', label: 'Name', placeholder: 'Display name' },
  { key: 'about', label: 'About', placeholder: 'Tell your story', multiline: true },
  { key: 'github', label: 'GitHub', placeholder: 'GitHub handle' },
  { key: 'twitter', label: 'X (Twitter)', placeholder: 'X handle' },
];

export default function EditProfileModal({
  visible, onClose, onSaved, address, initial, dark,
}: {
  visible: boolean; onClose: () => void;
  onSaved: (next: SnapshotProfile) => void;
  address: string; initial: SnapshotProfile; dark: boolean;
}): React.ReactElement {
  const { text: fg, link: head, bg, border, primary, inputBg } = usePalette();
  const blockRadius = useBlockRadius();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<SnapshotProfile>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** Re-seed the form whenever the parent reopens us with a fresh `initial`. */
  useEffect(() => { if (visible) setForm(initial); }, [visible, initial]);

  const pickAvatar = async (): Promise<void> => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', quality: 0.85, allowsMultipleSelection: false,
      /** Built-in square crop/resize step before upload — `allowsEditing` is
       *  part of expo-image-picker, no extra native dep. */
      allowsEditing: true, aspect: [1, 1],
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
      /** Push the new name/avatar into the shared peer-profile cache so every
       *  surface that renders the local user (group member rows, message
       *  bubbles, conversation topnav) reflects the change — incl. a fresh
       *  avatar cache-buster — without an app reload. */
      if (address) setPeerProfile(address, { name: form.name, avatar: form.avatar });
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
        {/** No title / Cancel chrome — a single close X is the dismiss affordance
         *  (this is a full-screen modal with no backdrop tap). */}
        <Box style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
          paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 12,
        }}>
          <Pressable onPress={onClose} disabled={saving} hitSlop={10}>
            <Icon name="x" size={24} color={head} />
          </Pressable>
        </Box>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <Box style={{ alignItems: 'center', marginBottom: 20 }}>
            <Pressable onPress={pickAvatar} disabled={uploading}>
              <Avatar
                address={address}
                size={AVATAR_SIZE}
                cacheBuster={getCacheHash(form.avatar)}
                style={{ backgroundColor: rowBg, opacity: uploading ? 0.5 : 1 }}
              />
              {uploading ? (
                <Box style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <Spinner size={20} color={fg} />
                </Box>
              ) : null}
            </Pressable>
            <Text size="sm" style={{ color: sub, marginTop: 8 }}>Tap to change avatar</Text>
          </Box>

          {FIELDS.map(f => (
            <Box key={f.key} style={{ marginBottom: 14 }}>
              <Text size="xs" style={{ color: sub, marginBottom: 4 }}>{f.label.toUpperCase()}</Text>
              {f.multiline ? (
                <Textarea
                  value={(form[f.key] ?? '') as string}
                  onChangeText={t => update(f.key, t)}
                  placeholder={f.placeholder}
                  placeholderTextColor={sub}
                  dark={dark}
                  style={{
                    color: fg, backgroundColor: inputBg, borderColor: border, borderWidth: 1,
                    borderRadius: blockRadius, padding: 12, fontSize: fontSize('md'),
                    minHeight: 80, height: undefined, textAlignVertical: 'top',
                  }}
                />
              ) : (
                <Input
                  value={(form[f.key] ?? '') as string}
                  onChangeText={t => update(f.key, t)}
                  placeholder={f.placeholder}
                  placeholderTextColor={sub}
                  dark={dark}
                  style={{
                    color: fg, backgroundColor: inputBg, borderColor: border, borderWidth: 1,
                    borderRadius: blockRadius, padding: 12, fontSize: fontSize('md'),
                    minHeight: 0, textAlignVertical: 'center',
                  }}
                />
              )}
            </Box>
          ))}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            dark={dark}
            disabled={saving || uploading}
            onPress={() => { void save(); }}
            label={saving ? 'Saving…' : 'Save'}
            tintBg={primary}
            tintFg={bg}
            style={{ marginTop: 16 }}
            textStyle={{ fontFamily: 'Calibre-Medium' }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
