import { useState } from 'react';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Image } from '@stage-labs/kit/react-native/image';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import type { PickedFile } from '@stage-labs/kit/react-native/file-picker';
import { Col } from '../layout';
import { FormField } from '../FormField';
import { BANNER_AVATAR_SIZE, OnboardingCard, SkipLink } from './OnboardingCard';
import { usePalette } from '../../lib/theme';
import { GroupImagePicker } from '../GroupImagePicker';
import { useNameAvailability } from '../settings/useNameAvailability';
import { claimStatusText, claimStatusTone, normalizeLabel, sanitizeLabelInput, type ClaimState } from '../settings/ProfileSettings.claim.model';
import { canContinueProfile, profileSetupFrom, profileStepProblem, type ProfileSetup } from './Onboarding.profile.model';

type Pal = ReturnType<typeof usePalette>;


function PicturePicker({ pal, image, busy, onPick }: {
  pal: Pal; image: PickedFile | null; busy: boolean; onPick: (file: PickedFile) => void;
}): React.ReactElement {
  const [pickNonce, setPickNonce] = useState(0);
  const ring = { borderWidth: 4, borderColor: pal.bg };
  return (
    <Pressable onPress={() => { if (!busy) setPickNonce((n) => n + 1); }} hitSlop={8} accessibilityLabel="Choose a profile picture">
      {image === null ? (
        <Col size={BANNER_AVATAR_SIZE} radius="full" background={pal.border} align="center" justify="center" style={ring}>
          <Icon name="camera" size={28} color={pal.sub} />
        </Col>
      ) : (
        <Image src={image.uri} size={BANNER_AVATAR_SIZE} radius="full" background={pal.border} style={ring} />
      )}
      <GroupImagePicker openNonce={pickNonce} onPick={onPick} />
    </Pressable>
  );
}

export function ProfileStep({ pal, dark, busy, onContinue }: {
  pal: Pal; dark: boolean; busy: boolean;
  onContinue: (profile: ProfileSetup | null) => void;
}): React.ReactElement {
  const [raw, setRaw] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [image, setImage] = useState<PickedFile | null>(null);
  const [state, setState] = useState<ClaimState>({ label: '', phase: 'idle' });
  const label = normalizeLabel(raw);
  useNameAvailability(label, setState);
  const problem = profileStepProblem(label, displayName, image !== null);
  const ready = canContinueProfile(state, label, displayName, image !== null);
  const footer = (
    <>
      <Button dark={dark} size="lg" fullWidth pill tintBg={pal.primary} tintFg={pal.bg}
        label="Continue" disabled={busy || !ready}
        onPress={() => { onContinue(profileSetupFrom(label, displayName, image)); }} />
      <SkipLink disabled={busy} onPress={() => { onContinue(null); }} />
    </>
  );
  return (
    <OnboardingCard title="Set up your profile" footer={footer}
      banner={<PicturePicker pal={pal} image={image} busy={busy} onPick={setImage} />}>
      <FormField label="Username" placeholder="e.g. alice123" value={raw} onChangeText={(t) => { setRaw(sanitizeLabelInput(t)); }} disabled={busy}
        inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
        hint={label === '' ? undefined : claimStatusText(state)} hintTone={claimStatusTone(state)} />
      <FormField label="Name" placeholder="e.g. Alice" value={displayName} onChangeText={setDisplayName} disabled={busy} />
      {problem === null ? null : <Text size="xs" color={pal.sub}>{problem}</Text>}
    </OnboardingCard>
  );
}
