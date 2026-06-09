/** Group-detail header editor — image picker, inline name + description editing.
 *  Extracted from group/[convId] for lint line-budget. Rendering identical. */

import { Pressable } from '@metro-labs/kit/pressable';
import { fontSize } from '@metro-labs/kit/tokens';
import { Input } from '@metro-labs/kit/input';
import { Textarea } from '@metro-labs/kit/textarea';
import { Image } from '@metro-labs/kit/image';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../../components/layout';
import { Spinner } from '../../components/Spinner';
import { Button } from '@metro-labs/kit/button';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';
import { channelStampSeed, stampAvatarUrl } from '@metro-labs/kit/avatar';
import { usePalette } from '../../lib/theme';

/** Inline "Save" pill shared by the name + description editors. A small primary
 *  button matched to the prior bespoke pill: paddingHorizontal 14, the legacy
 *  13px Calibre-Medium label, height ~32 (kit `sm`). */
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
      textStyle={{ fontSize: fontSize('sm'), fontFamily: 'Calibre-Medium' }}
    />
  );
}

interface Pal { fg: string; head: string; sub: string; border: string; rowBg: string; inputBg: string; }

/** Group header — mirrors the user ProfileScreen layout exactly: a full-bleed
 *  cover banner (rowBg), then a page-bg sheet pulled UP 18px with rounded top
 *  corners, and the group avatar (88px, square) overlapping the cover at
 *  marginTop -44 (~80% over cover, half over the rounded black edge). The cover
 *  has no dedicated image (groups carry a single avatar), so it uses the same
 *  flat rowBg fallback the user profile uses. Tap avatar → view, hold → change. */
export function GroupProfileHeader({ imageUrl, channelId, uploadingImage, insetTop, fg, sub, bg, rowBg, onTap, onPick }: {
  imageUrl: string; channelId: string; uploadingImage: boolean; insetTop: number;
  fg: string; sub: string; bg: string; rowBg: string;
  onTap: () => void; onPick: () => void;
}): React.ReactElement {
  /** No uploaded image → deterministic stamp.fyi identicon seeded by the channel
   *  id, matching the list + header fallback so the channel reads the same
   *  everywhere. Long-press still opens the picker (caption keeps the hint). */
  const fallbackUri = channelId ? stampAvatarUrl(channelStampSeed(channelId), 88) : '';
  return (
    <>
      {/* Cover extends up behind the floating topnav/status bar so the colour
          bleeds to y=0 (height += insetTop), exactly like ProfileScreen route. */}
      <Box bg={rowBg} style={{ height: 140 + insetTop }} />
      <Box style={{
        alignItems: 'flex-start', paddingHorizontal: 16,
        backgroundColor: bg, marginTop: -18,
        borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'visible',
      }}>
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
            <Box style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Spinner size={20} color={fg} />
            </Box>
          ) : null}
        </Pressable>
        <Text size="sm" style={{ color: sub, marginTop: 6 }}>
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
    <Box style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
      {editing ? (
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
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
          <SaveButton saving={saving} disabled={saving || !draft.trim()} onSave={onSave} dark={dark} />
        </Box>
      ) : (
        <Pressable onPress={() => setEditing(true)} hitSlop={6} style={{ marginTop: 6, alignItems: 'flex-start' }}>
          <Text weight="semibold" size="xxl" style={{ color: head, textAlign: 'left' }}>
            {name && name.trim() ? name : 'Untitled group'}
          </Text>
          <Text size="sm" style={{ color: sub, marginTop: 4 }}>Tap to rename</Text>
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
    <Box style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
      <Text size="sm" style={{ color: sub }}>DESCRIPTION</Text>
      {editing ? (
        <Box style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6 }}>
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
          <SaveButton saving={saving} disabled={saving} onSave={onSave} dark={dark} />
        </Box>
      ) : (
        <Pressable onPress={() => setEditing(true)} hitSlop={6} style={{ marginTop: 6 }}>
          <Text size="md" style={{ color: description.trim() ? fg : sub }}>
            {description.trim() || 'Tap to add a description'}
          </Text>
        </Pressable>
      )}
    </Box>
  );
}
