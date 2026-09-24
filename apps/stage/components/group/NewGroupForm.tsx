import { useCallback, useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { useRouter } from 'expo-router';
import { createGroup } from '../../modules/messaging';
import { uploadAvatar } from '../../lib/profile';
import { capabilities } from '../../lib/capabilities';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { GroupImagePicker } from '../GroupImagePicker';
import { Box, Col } from '../layout';
import { FormField } from '../FormField';
import { Spinner } from '../Spinner';
import { MemberPicker, useMemberPicker } from './MemberPicker';

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

function useCreateGroup(onDone: () => void): {
  creating: boolean; create: (addresses: string[], name: string, image: PickedImage | null) => Promise<void>;
} {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const create = useCallback(async (addresses: string[], name: string, image: PickedImage | null): Promise<void> => {
    if (addresses.length === 0 || creating) return;
    setCreating(true);
    let imageUrl: string | undefined;
    if (image) {
      try {
        imageUrl = await uploadAvatar(image.uri, image.mime, image.name);
      } catch {
        capabilities.toast("Couldn't upload the group image. Creating without it.");
      }
    }
    try {
      const { id } = await createGroup(addresses, name, imageUrl);
      onDone();
      router.push({ pathname: '/channel/[convId]', params: { convId: id } });
    } catch (err) {
      capabilities.toast((err as Error)?.message ?? "Couldn't create the group");
    } finally {
      setCreating(false);
    }
  }, [creating, onDone, router]);
  return { creating, create };
}

function MembersStep({ picker, onNext }: {
  picker: ReturnType<typeof useMemberPicker>; onNext: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { primary, bg } = usePalette();
  const count = picker.members.length;
  return (
    <Col gap={16}>
      <MemberPicker state={picker} dark={dark}/>
      <Button size="lg" fullWidth pill dark={dark} disabled={count === 0} tintBg={primary} tintFg={bg}
        label={count > 0 ? `Next (${count})` : 'Next'} onPress={onNext} />
    </Col>
  );
}

function DetailsStep({ addresses, onBack, onDone }: {
  addresses: string[]; onBack: () => void; onDone: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, border, primary, bg } = usePalette();
  const [name, setName] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [pickNonce, setPickNonce] = useState(0);
  const { creating, create } = useCreateGroup(onDone);
  return (
    <Col gap={16}>
      <GroupImageField image={image} creating={creating} fg={fg} border={border} rowBg={border}
        onPick={() => { if (!creating) setPickNonce(n => n + 1); }}/>
      <GroupImagePicker
        openNonce={pickNonce}
        onPick={(file) => { setImage({ uri: file.uri, mime: file.mime, name: file.name ?? 'group-avatar' }); }}
      />
      <GroupNameField name={name} setName={setName} />
      <Button size="lg" fullWidth pill dark={dark} loading={creating} tintBg={primary} tintFg={bg}
        label="Create group" onPress={() => { void create(addresses, name, image); }} />
      <Button size="lg" fullWidth pill dark={dark} color="secondary" variant="ghost" disabled={creating} label="Back" onPress={onBack} />
    </Col>
  );
}

export function NewGroupForm({ onDone }: { onDone: () => void }): React.ReactElement {
  const picker = useMemberPicker();
  const [step, setStep] = useState<'members' | 'details'>('members');
  if (step === 'members') return <MembersStep picker={picker} onNext={() => { setStep('details'); }} />;
  return <DetailsStep addresses={picker.members.map(m => m.address)} onBack={() => { setStep('members'); }} onDone={onDone} />;
}
