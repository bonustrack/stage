/** Group-detail header editor — image picker, inline name + description editing.
 *  Extracted from group/[convId] for lint line-budget. Rendering identical. */

import { Image, Pressable, TextInput } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../../components/layout';
import { Spinner } from '../../components/Spinner';
import { avatarRenderUrl } from '@metro-labs/client/profile/snapshot';

interface Pal { fg: string; head: string; sub: string; border: string; rowBg: string; }

export function GroupImageEditor({ imageUrl, uploadingImage, fg, sub, border, rowBg, onTap, onPick }: {
  imageUrl: string; uploadingImage: boolean;
  fg: string; sub: string; border: string; rowBg: string;
  onTap: () => void; onPick: () => void;
}): React.ReactElement {
  return (
    <Box style={{ alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 }}>
      <Pressable onPress={onTap} onLongPress={onPick} disabled={uploadingImage} hitSlop={8}>
        {imageUrl ? (
          <Image
            source={{ uri: avatarRenderUrl('', imageUrl, 256) }}
            style={{ width: 128, height: 128, borderRadius: 15, backgroundColor: rowBg, opacity: uploadingImage ? 0.5 : 1 }}
          />
        ) : (
          <Box style={{
            width: 128, height: 128, borderRadius: 15, backgroundColor: rowBg,
            borderWidth: 1, borderColor: border,
            alignItems: 'center', justifyContent: 'center',
            opacity: uploadingImage ? 0.5 : 1,
          }}>
            <Text style={{ color: sub, fontSize: 28 }}>＋</Text>
          </Box>
        )}
        {uploadingImage ? (
          <Box style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size={20} color={fg} />
          </Box>
        ) : null}
      </Pressable>
      <Text style={{ color: sub, fontSize: 13, marginTop: 6, fontFamily: 'Calibre-Medium' }}>
        {uploadingImage ? 'Uploading…' : imageUrl ? 'Tap to view · hold to change' : 'Tap to add image'}
      </Text>
    </Box>
  );
}

export function GroupNameEditor({ name, draft, setDraft, editing, setEditing, saving, onSave, dark, p }: {
  name: string | null; draft: string; setDraft: (s: string) => void;
  editing: boolean; setEditing: (b: boolean) => void; saving: boolean; onSave: () => void;
  dark: boolean; p: Pal;
}): React.ReactElement {
  const { fg, head, sub, border, rowBg } = p;
  return (
    <Box style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
      {editing ? (
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Group name"
            placeholderTextColor={sub}
            autoFocus
            style={{
              flex: 1, color: fg, backgroundColor: rowBg,
              borderWidth: 1, borderColor: border, borderRadius: 10,
              paddingHorizontal: 10, paddingVertical: 8, fontSize: 16,
            }}
          />
          <Pressable onPress={onSave} disabled={saving || !draft.trim()}
            style={({ pressed }) => ({
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
              backgroundColor: dark ? '#ffffff' : '#000000',
              opacity: pressed ? 0.85 : (saving || !draft.trim()) ? 0.5 : 1,
            })}>
            <Text style={{ color: dark ? '#000000' : '#ffffff', fontSize: 13, fontFamily: 'Calibre-Medium' }}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </Box>
      ) : (
        <Pressable onPress={() => setEditing(true)} hitSlop={6} style={{ marginTop: 6, alignItems: 'flex-start' }}>
          <Text style={{ color: head, fontSize: 22, fontFamily: 'Calibre-Semibold', textAlign: 'left' }}>
            {name && name.trim() ? name : 'Untitled group'}
          </Text>
          <Text style={{ color: sub, fontSize: 12, marginTop: 4, fontFamily: 'Calibre-Medium' }}>Tap to rename</Text>
        </Pressable>
      )}
    </Box>
  );
}

export function GroupDescriptionEditor({ description, descriptionDraft, setDescriptionDraft, editing, setEditing, saving, onSave, dark, p }: {
  description: string; descriptionDraft: string; setDescriptionDraft: (s: string) => void;
  editing: boolean; setEditing: (b: boolean) => void; saving: boolean; onSave: () => void;
  dark: boolean; p: Pal;
}): React.ReactElement {
  const { fg, sub, border, rowBg } = p;
  return (
    <Box style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
      <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>DESCRIPTION</Text>
      {editing ? (
        <Box style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6 }}>
          <TextInput
            value={descriptionDraft}
            onChangeText={setDescriptionDraft}
            placeholder="What is this group about?"
            placeholderTextColor={sub}
            multiline
            autoFocus
            style={{
              flex: 1, color: fg, backgroundColor: rowBg,
              borderWidth: 1, borderColor: border, borderRadius: 10,
              paddingHorizontal: 10, paddingVertical: 8, fontSize: 14,
              minHeight: 60, textAlignVertical: 'top',
            }}
          />
          <Pressable onPress={onSave} disabled={saving}
            style={({ pressed }) => ({
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
              backgroundColor: dark ? '#ffffff' : '#000000',
              opacity: pressed ? 0.85 : saving ? 0.5 : 1,
            })}>
            <Text style={{ color: dark ? '#000000' : '#ffffff', fontSize: 13, fontFamily: 'Calibre-Medium' }}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </Box>
      ) : (
        <Pressable onPress={() => setEditing(true)} hitSlop={6} style={{ marginTop: 6 }}>
          <Text style={{ color: description.trim() ? fg : sub, fontSize: 14, fontFamily: 'Calibre-Medium' }}>
            {description.trim() || 'Tap to add a description'}
          </Text>
        </Pressable>
      )}
    </Box>
  );
}
