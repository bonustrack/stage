
import { useCallback, useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { createGroup } from '../../modules/messaging';
import { uploadAvatar } from '../../lib/profile';
import { capabilities } from '../../lib/capabilities';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { StackHeader } from '../../components/chrome/StackHeader';
import { GroupImagePicker } from '../../components/GroupImagePicker';
import { Box, Col, ScreenScroll } from '../../components/layout';
import { FormField } from '../../components/FormField';
import { Spinner } from '../../components/Spinner';
import { MemberPicker, MemberPickerFooter, useMemberPicker } from './MemberPicker';

interface PickedImage { uri: string; mime: string; name: string }

function GroupImageField({ image, creating, fg, border, rowBg, onPick }: {
  image: PickedImage | null; creating: boolean;
  fg: string; border: string; rowBg: string; onPick: () => void;
}): React.ReactElement {
  return (
    <Box align="center" gap={8}>
      <Pressable onPress={onPick} disabled={creating} hitSlop={8}>
        {image ? (
          <Image
            src={image.uri}
            style={{
              width: 88, height: 88, borderRadius: Math.round(88 * 0.12),
              backgroundColor: rowBg, opacity: creating ? 0.5 : 1,
            }}
/>
        ) : (
          <Box width={88} height={88} radius={Math.round(88 * 0.12)} surface="raised" align="center" justify="center" style={{ borderWidth: 1, borderColor: border }}>
            <Text size="6xl" role="secondary">＋</Text>
          </Box>
        )}
        {creating && image ? (
          <Box align="center" justify="center" style={{ position: 'absolute', inset: 0 }}>
            <Spinner size={20} color={fg}/>
          </Box>
        ) : null}
      </Pressable>
      <Text size="xs" role="secondary">
        {image ? 'Tap to change image' : 'Tap to add a group image'}
      </Text>
    </Box>
  );
}

function GroupNameField({ name, setName }: { name: string; setName: (s: string) => void }): React.ReactElement {
  return <FormField label="Group name (optional)" placeholder="e.g. Stage builders" value={name} onChangeText={setName} />;
}

export default function NewGroup(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, border } = usePalette();
  const rowBg = border;
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const picker = useMemberPicker();
  const { members } = picker;
  const [creating, setCreating] = useState(false);
  const [image, setImage] = useState<PickedImage | null>(null);
  const [pickNonce, setPickNonce] = useState(0);

  const pickImage = useCallback((): void => {
    if (creating) return;
    setPickNonce(n => n + 1);
  }, [creating]);

  const onCreate = useCallback(async (): Promise<void> => {
    if (members.length === 0 || creating) return;
    setCreating(true);
    let imageUrl: string | undefined;
    if (image) {
      try {
        imageUrl = await uploadAvatar(image.uri, image.mime, image.name);
      } catch {
        capabilities.toast("Couldn't upload the group image — creating without it.");
      }
    }
    try {
      const { id } = await createGroup(members.map(m => m.address), name, imageUrl);
      router.replace({ pathname: '/channel/[convId]', params: { convId: id } });
    } catch (err) {
      capabilities.toast((err as Error)?.message ?? "Couldn't create the group");
      setCreating(false);
    }
  }, [members, name, image, creating, router]);

  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="New group" />

      <ScreenScroll
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
>
        <GroupImageField image={image} creating={creating} fg={fg} border={border} rowBg={rowBg}
          onPick={() => { pickImage(); }}/>
        <GroupImagePicker
          openNonce={pickNonce}
          onPick={(file) => {
            setImage({ uri: file.uri, mime: file.mime, name: file.name ?? 'group-avatar' });
          }}
        />

        <GroupNameField name={name} setName={setName} />

        <MemberPicker state={picker} dark={dark}/>
      </ScreenScroll>

      <MemberPickerFooter count={members.length} busy={creating} verb="Create group" onPress={() => { void onCreate(); }} />
    </Col>
  );
}
