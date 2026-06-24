
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { fontSize } from '@stage-labs/kit/tokens';
import { Input } from '@stage-labs/kit/react-native/input';
import { Textarea } from '@stage-labs/kit/react-native/textarea';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row } from '../../components/layout';
import { Spinner } from '../../components/Spinner';
import { Button } from '@stage-labs/kit/react-native/button';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';
import { channelStampSeed, stampAvatarUrl } from '@stage-labs/kit/avatar';
import { usePalette } from '../../lib/theme';

function SaveButton({ saving, disabled, onSave, dark }: {
  saving: boolean; disabled: boolean; onSave: () => void; dark: boolean;
}): React.ReactElement {
  const { primary, bg } = usePalette();
  return (
    <Button
      variant="primary"
      size="sm"
      dark={dark}
      disabled={disabled}
      onPress={onSave}
      label={saving ? 'Saving…' : 'Save'}
      tintBg={primary}
      tintFg={bg}
      style={{ paddingHorizontal: 14 }}
      textStyle={{ fontSize: fontSize('xs'), fontFamily: 'Calibre-Medium' }}
/>
  );
}

interface Pal { fg: string; head: string; sub: string; border: string; rowBg: string; inputBg: string; }

export function GroupProfileHeader({ imageUrl, channelId, uploadingImage, insetTop, fg, bg, rowBg, onTap, onPick }: {
  imageUrl: string; channelId: string; uploadingImage: boolean; insetTop: number;
  fg: string; bg: string; rowBg: string;
  onTap: () => void; onPick: () => void;
}): React.ReactElement {
  const fallbackUri = channelId ? stampAvatarUrl(channelStampSeed(channelId), 88) : '';
  return (
    <>
      {}
      <Box height={140 + insetTop} surface="raised"/>
      <Box surface="surface" padding={{ x: 16 }} margin={{ top: -18 }} align="start" style={{ borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'visible' }}>
        <Pressable onPress={onTap} onLongPress={onPick} disabled={uploadingImage} hitSlop={8}
          style={{ marginTop: -44, zIndex: 1 }}>
          <Image
            src={imageUrl ? avatarRenderUrl('', imageUrl, 256) : fallbackUri}
            style={{
              width: 88, height: 88, borderRadius: Math.round(88 * 0.12),
              backgroundColor: rowBg, borderWidth: 3, borderColor: bg,
              opacity: uploadingImage ? 0.5 : 1,
            }}
/>
          {uploadingImage ? (
            <Box align="center" justify="center" style={{ position: 'absolute', inset: 0 }}>
              <Spinner size={20} color={fg}/>
            </Box>
          ) : null}
        </Pressable>
        <Text size="xs" role="secondary" style={{ marginTop: 6 }}>
          {uploadingImage ? 'Uploading…' : imageUrl ? 'Tap to view · hold to change' : 'Tap to add image'}
        </Text>
      </Box>
    </>
  );
}

export function GroupNameEditor({ name, draft, setDraft, editing, setEditing, saving, onSave, dark, p }: {
  name: string | null; draft: string; setDraft: (s: string) => void;
  editing: boolean; setEditing: (b: boolean) => void; saving: boolean; onSave: () => void;
  dark: boolean; p: Pal;
}): React.ReactElement {
  const { fg, head, sub, border, inputBg } = p;
  return (
    <Box padding={{ x: 16, bottom: 16 }}>
      {editing ? (
        <Row margin={{ top: 6 }} align="center" gap={8}>
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder="Group name"
            placeholderTextColor={sub}
            autoFocus
            dark={dark}
            style={{
              flex: 1, color: fg, backgroundColor: inputBg,
              borderWidth: 1, borderColor: border, borderRadius: 10,
              paddingHorizontal: 10, paddingVertical: 8, fontSize: fontSize('md'),
            }}
/>
          <SaveButton saving={saving} disabled={saving || !draft.trim()} onSave={onSave} dark={dark}/>
        </Row>
      ) : (
        <Pressable onPress={() => { setEditing(true); }} hitSlop={6} style={{ marginTop: 6, alignItems: 'flex-start' }}>
          <Text weight="semibold" size="5xl" color={head} style={{ textAlign: 'left' }}>
            {name?.trim() ? name : 'Untitled group'}
          </Text>
          <Text size="xs" role="secondary" style={{ marginTop: 4 }}>Tap to rename</Text>
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
  const { fg, sub, border, inputBg } = p;
  return (
    <Box padding={{ x: 16, bottom: 16 }}>
      <Text size="xs" role="secondary">DESCRIPTION</Text>
      {editing ? (
        <Row margin={{ top: 6 }} align="start" gap={8}>
          <Textarea
            value={descriptionDraft}
            onChangeText={setDescriptionDraft}
            placeholder="What is this group about?"
            placeholderTextColor={sub}
            autoFocus
            dark={dark}
            style={{
              flex: 1, color: fg, backgroundColor: inputBg,
              borderWidth: 1, borderColor: border, borderRadius: 10,
              paddingHorizontal: 10, paddingVertical: 8, fontSize: fontSize('md'),
              minHeight: 60, textAlignVertical: 'top',
            }}
/>
          <SaveButton saving={saving} disabled={saving} onSave={onSave} dark={dark}/>
        </Row>
      ) : (
        <Pressable onPress={() => { setEditing(true); }} hitSlop={6} style={{ marginTop: 6 }}>
          <Text size="md" color={description.trim() ? fg : sub}>
            {description.trim() || 'Tap to add a description'}
          </Text>
        </Pressable>
      )}
    </Box>
  );
}
