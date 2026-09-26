import { useState } from 'react';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { FormField } from './FormField';
import { Spinner } from './Spinner';
import { RailTooltip } from './tabs/RailTooltip';
import { usePalette } from '../lib/theme';
import { randomUsername } from '../lib/randomUsername';
import { useNameAvailability } from './settings/useNameAvailability';
import { claimStatusTone, normalizeLabel, sanitizeLabelInput, type ClaimState } from './settings/ProfileSettings.claim.model';
import { usernameHint, usernameStatus } from './UsernameField.model';
import { IconArrowLeftRight } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowLeftRight';
import { IconCircleCheck } from '@central-icons-react-native/round-filled-radius-1-stroke-2/IconCircleCheck';
import { IconCircleX } from '@central-icons-react-native/round-filled-radius-1-stroke-2/IconCircleX';

type Pal = ReturnType<typeof usePalette>;

const STATUS_ICON = 24;
const SHUFFLE_ICON = 16;
const NOOP = (): void => undefined;

export interface UsernameInput {
  raw: string;
  setRaw: (raw: string) => void;
  label: string;
  state: ClaimState;
  setState: (next: ClaimState) => void;
}

const FROZEN_PHASES = new Set<ClaimState['phase']>(['claiming', 'claimed']);

export function useUsernameInput(): UsernameInput {
  const [raw, setRaw] = useState('');
  const [state, setState] = useState<ClaimState>({ label: '', phase: 'idle' });
  const label = normalizeLabel(raw);
  const frozen = FROZEN_PHASES.has(state.phase);
  useNameAvailability(frozen ? state.label : label, frozen ? NOOP : setState);
  return { raw, setRaw, label, state, setState };
}

function ShuffleButton({ pal, disabled, onPick }: { pal: Pal; disabled: boolean; onPick: (label: string) => void }): React.ReactElement {
  return (
    <RailTooltip label="Random username" onPress={() => { if (!disabled) onPick(randomUsername()); }} style={undefined}>
      <Glyph icon={IconArrowLeftRight} size={SHUFFLE_ICON} color={pal.sub} />
    </RailTooltip>
  );
}

function StatusMark({ state, label, pal }: { state: ClaimState; label: string; pal: Pal }): React.ReactElement | undefined {
  const status = usernameStatus(state, label);
  if (status === null) return undefined;
  if (status.kind === 'checking') return <Spinner size={STATUS_ICON} color={pal.sub} />;
  const ok = status.kind === 'ok';
  return (
    <RailTooltip label={status.tip} onPress={NOOP} style={undefined}>
      <Glyph icon={ok ? IconCircleCheck : IconCircleX} size={STATUS_ICON} color={ok ? pal.success : pal.danger} />
    </RailTooltip>
  );
}

export function UsernameField({ input, busy }: { input: UsernameInput; busy: boolean }): React.ReactElement {
  const pal = usePalette();
  const { raw, setRaw, label, state } = input;
  return (
    <FormField label="Username" placeholder="e.g. alice123" value={raw} onChangeText={(t) => { setRaw(sanitizeLabelInput(t)); }} disabled={busy}
      labelTrailing={<ShuffleButton pal={pal} disabled={busy} onPick={setRaw} />}
      inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
      trailing={StatusMark({ state, label, pal })}
      hint={usernameHint(state, label)} hintTone={claimStatusTone(state)} />
  );
}
