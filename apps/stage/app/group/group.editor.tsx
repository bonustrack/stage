
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { TextField } from '@stage-labs/kit/react-native/text-field';
import { Button } from '@stage-labs/kit/react-native/button';
import { fontSize } from '@stage-labs/kit/tokens';
import { Box, Row } from '../../components/layout';
import { Spinner } from '../../components/Spinner';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';
import { channelStampSeed, stampAvatarUrl } from '@stage-labs/kit/avatar';
import { usePalette } from '../../lib/theme';

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

function GroupFieldEditor({ value, placeholder, saveLabel, disabled, multiline, minHeight, dark, p, onChangeText, onSave }: {
  value: string; placeholder: string; saveLabel: string; disabled: boolean;
  multiline?: boolean; minHeight?: number; dark: boolean; p: Pal;
  onChangeText: (s: string) => void; onSave: () => void;
}): React.ReactElement {
  const { fg, sub, border, inputBg } = p;
  const { primary, bg } = usePalette();
  return (
    <Row align={multiline === true ? 'start' : 'center'} gap={8} padding={{ top: 6 }}>
      <Box flex={1}>
        <TextField
          name="field"
          value={value}
          placeholder={placeholder}
          variant="outline"
          multiline={multiline}
          minHeight={minHeight}
          autoFocus
          background={inputBg}
          borderColor={border}
          color={fg}
          placeholderColor={sub}
          radius={10}
          paddingX={10}
          paddingY={8}
          dark={dark}
          onChangeText={onChangeText}
        />
      </Box>
      <Button
        label={saveLabel}
        color="primary"
        variant="solid"
        size="sm"
        dark={dark}
        tintBg={primary}
        tintFg={bg}
        style={{ paddingHorizontal: 14 }}
        textStyle={{ fontSize: fontSize('xs'), fontFamily: 'Calibre-Medium' }}
        disabled={disabled}
        onPress={onSave}
      />
    </Row>
  );
}

export function GroupNameEditor({ name, draft, setDraft, editing, setEditing, saving, onSave, dark, p }: {
  name: string | null; draft: string; setDraft: (s: string) => void;
  editing: boolean; setEditing: (b: boolean) => void; saving: boolean; onSave: () => void;
  dark: boolean; p: Pal;
}): React.ReactElement {
  const { head } = p;
  return (
    <Box padding={{ x: 16, bottom: 16 }}>
      {editing ? (
        <GroupFieldEditor
          value={draft}
          placeholder="Group name"
          saveLabel={saving ? 'Saving…' : 'Save'}
          disabled={saving || !draft.trim()}
          dark={dark}
          p={p}
          onChangeText={setDraft}
          onSave={onSave}
        />
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
  const { fg, sub } = p;
  return (
    <Box padding={{ x: 16, bottom: 16 }}>
      <Text size="xs" role="secondary">DESCRIPTION</Text>
      {editing ? (
        <GroupFieldEditor
          value={descriptionDraft}
          placeholder="What is this group about?"
          saveLabel={saving ? 'Saving…' : 'Save'}
          disabled={saving}
          multiline
          minHeight={60}
          dark={dark}
          p={p}
          onChangeText={setDescriptionDraft}
          onSave={onSave}
        />
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
