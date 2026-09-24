
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { fontSize } from '@stage-labs/kit/tokens';
import { Box, Row, PAGE_GUTTER } from '../layout';
import { FormField } from '../FormField';
import { Spinner } from '../Spinner';
import { avatarRenderUrl } from '@stage-labs/client/profile/avatar';
import { channelStampSeed, stampAvatarUrl } from '@stage-labs/kit/avatar';
import { usePalette } from '../../lib/theme';

export function GroupProfileHeader({ imageUrl, channelId, uploadingImage, insetTop, onTap, onPick }: {
  imageUrl: string; channelId: string; uploadingImage: boolean; insetTop: number;
  onTap: () => void; onPick: () => void;
}): React.ReactElement {
  const { text: fg, bg, border: rowBg } = usePalette();
  const fallbackUri = channelId ? stampAvatarUrl(channelStampSeed(channelId), 88) : '';
  return (
    <>
      <Box height={140 + insetTop} surface="raised"/>
      <Box surface="surface" padding={{ x: PAGE_GUTTER }} margin={{ top: -18 }} align="start" style={{ borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'visible' }}>
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

function GroupFieldEditor({ label, value, placeholder, saveLabel, disabled, multiline, dark, onChangeText, onSave }: {
  label: string; value: string; placeholder: string; saveLabel: string; disabled: boolean;
  multiline?: boolean; dark: boolean;
  onChangeText: (s: string) => void; onSave: () => void;
}): React.ReactElement {
  const { primary, bg } = usePalette();
  return (
    <Row align={multiline === true ? 'start' : 'center'} gap={8} padding={{ top: 6 }}>
      <Box flex={1}>
        <FormField label={label} value={value} placeholder={placeholder} multiline={multiline} rows={2}
          onChangeText={onChangeText} inputProps={{ autoFocus: true }} />
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

export function GroupNameEditor({ name, draft, setDraft, saving, onSave, dark }: {
  name: string | null; draft: string | null; setDraft: (s: string | null) => void;
  saving: boolean; onSave: () => void; dark: boolean;
}): React.ReactElement {
  const { link: head } = usePalette();
  return (
    <Box padding={{ x: PAGE_GUTTER, bottom: 16 }}>
      {draft !== null ? (
        <GroupFieldEditor
          label="Name"
          value={draft}
          placeholder="Group name"
          saveLabel={saving ? 'Saving…' : 'Save'}
          disabled={saving || !draft.trim()}
          dark={dark}
          onChangeText={setDraft}
          onSave={onSave}
        />
      ) : (
        <Pressable onPress={() => { setDraft(name ?? ''); }} hitSlop={6} style={{ marginTop: 6, alignItems: 'flex-start' }}>
          <Text weight="semibold" size="5xl" color={head} style={{ textAlign: 'left' }}>
            {name?.trim() ? name : 'Untitled group'}
          </Text>
          <Text size="xs" role="secondary" style={{ marginTop: 4 }}>Tap to rename</Text>
        </Pressable>
      )}
    </Box>
  );
}

export function GroupDescriptionEditor({ description, draft, setDraft, saving, onSave, dark }: {
  description: string; draft: string | null; setDraft: (s: string | null) => void;
  saving: boolean; onSave: () => void; dark: boolean;
}): React.ReactElement {
  const { text: fg } = usePalette();
  return (
    <Box padding={{ x: PAGE_GUTTER, bottom: 16 }}>
      <Text size="xs" role="secondary">DESCRIPTION</Text>
      {draft !== null ? (
        <GroupFieldEditor
          label="Description"
          value={draft}
          placeholder="What is this group about?"
          saveLabel={saving ? 'Saving…' : 'Save'}
          disabled={saving}
          multiline
          dark={dark}
          onChangeText={setDraft}
          onSave={onSave}
        />
      ) : (
        <Pressable onPress={() => { setDraft(description); }} hitSlop={6} style={{ marginTop: 6 }}>
          <Text size="md" color={fg}>
            {description.trim() || 'Tap to add a description'}
          </Text>
        </Pressable>
      )}
    </Box>
  );
}
