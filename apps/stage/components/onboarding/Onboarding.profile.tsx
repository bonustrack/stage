import { useState } from 'react';
import { Title } from '@stage-labs/kit/react-native/title';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Input } from '@stage-labs/kit/react-native/input';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Image } from '@stage-labs/kit/react-native/image';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { fontSize } from '@stage-labs/kit/tokens';
import type { PickedFile } from '@stage-labs/kit/react-native/file-picker';
import { Box, Col } from '../layout';
import { usePalette } from '../../lib/theme';
import { GroupImagePicker } from '../GroupImagePicker';
import { useNameAvailability } from '../settings/useNameAvailability';
import { claimStatusText, normalizeLabel, type ClaimState } from '../settings/ProfileSettings.claim.model';
import { canContinueProfile, profileSetupFrom, profileStepProblem, type ProfileSetup } from './Onboarding.profile.model';

type Pal = ReturnType<typeof usePalette>;

const PICTURE_SIZE = 88;

function fieldStyle(pal: Pal): { color: string; borderColor: string; borderWidth: number; borderRadius: number; paddingHorizontal: number; paddingVertical: number; fontFamily: string; fontSize: number } {
  return {
    color: pal.text, borderColor: pal.border, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12, fontFamily: 'Calibre-Medium', fontSize: fontSize('lg'),
  };
}

function PicturePicker({ pal, image, busy, onPick }: {
  pal: Pal; image: PickedFile | null; busy: boolean; onPick: (file: PickedFile) => void;
}): React.ReactElement {
  const [pickNonce, setPickNonce] = useState(0);
  return (
    <Col align="center" gap={8}>
      <Pressable onPress={() => { if (!busy) setPickNonce((n) => n + 1); }} hitSlop={8} accessibilityLabel="Choose a profile picture">
        {image === null ? (
          <Col size={PICTURE_SIZE} radius="full" background={pal.border} align="center" justify="center">
            <Icon name="camera" size={28} color={pal.sub} />
          </Col>
        ) : (
          <Image src={image.uri} size={PICTURE_SIZE} radius="full" background={pal.border} />
        )}
      </Pressable>
      <Text size="sm" color={pal.sub}>{image === null ? 'Add a picture' : 'Change picture'}</Text>
      <GroupImagePicker openNonce={pickNonce} onPick={onPick} />
    </Col>
  );
}

export function ProfileStep({ pal, dark, busy, onContinue, onBack }: {
  pal: Pal; dark: boolean; busy: boolean;
  onContinue: (profile: ProfileSetup | null) => void; onBack: () => void;
}): React.ReactElement {
  const [raw, setRaw] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [image, setImage] = useState<PickedFile | null>(null);
  const [state, setState] = useState<ClaimState>({ label: '', phase: 'idle' });
  const label = normalizeLabel(raw);
  useNameAvailability(label, setState);
  const problem = profileStepProblem(label, displayName, image !== null);
  const ready = canContinueProfile(state, label, displayName, image !== null);
  return (
    <Col flex={1} justify="between" gap={24}>
      <Col gap={16} padding={{ top: 8 }}>
        <Title level={2} color={pal.primary}>Set up your profile</Title>
        <PicturePicker pal={pal} image={image} busy={busy} onPick={setImage} />
        <Box gap={6}>
          <Input value={raw} onChangeText={setRaw} placeholder="username" placeholderTextColor={pal.sub} dark={dark}
            disabled={busy} inputType="text" style={fieldStyle(pal)} inputProps={{ autoCapitalize: 'none', autoCorrect: false }} />
          <Text size="xs" color={pal.sub}>
            {label === '' ? 'Your free name: username.stage.base.eth' : claimStatusText(state)}
          </Text>
        </Box>
        <Input value={displayName} onChangeText={setDisplayName} placeholder="Display name" placeholderTextColor={pal.sub}
          dark={dark} disabled={busy} inputType="text" style={fieldStyle(pal)} />
        {problem === null ? null : <Text size="xs" color={pal.sub}>{problem}</Text>}
      </Col>
      <Col gap={10}>
        <Button dark={dark} size="lg" fullWidth tintBg={pal.primary} tintFg={pal.bg}
          label="Continue" disabled={busy || !ready}
          onPress={() => { onContinue(profileSetupFrom(label, displayName, image)); }} />
        <Button dark={dark} variant="ghost" size="lg" fullWidth label="Skip for now" disabled={busy}
          onPress={() => { onContinue(null); }} />
        <Button dark={dark} variant="ghost" size="lg" fullWidth label="Back" disabled={busy} onPress={onBack} />
      </Col>
    </Col>
  );
}
