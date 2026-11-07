import { useEffect, useState } from 'react';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { FormField } from '../FormField';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { HoverTooltip } from '../HoverTooltip';
import { Column } from '../layout';
import { usePalette } from '../../lib/theme';
import { randomUsername } from '@stage-labs/client/identity/stageNames';
import {
  claimStatusTone,
  localLabelProblem,
  normalizeLabel,
  sanitizeLabelInput,
  usernameHint,
  usernameStatus,
  type ClaimState,
} from './username.model';
import { IconArrowLeftRight } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowLeftRight';
import { IconCircleCheck } from '@central-icons-react-native/round-filled-radius-1-stroke-2/IconCircleCheck';
import { IconCircleX } from '@central-icons-react-native/round-filled-radius-1-stroke-2/IconCircleX';
import { errorMessage } from '@stage-labs/client/errors';
import { checkStageName } from '../../lib/profile';

const CHECK_DEBOUNCE_MS = 400;

function useNameAvailability(label: string, setState: (next: ClaimState) => void): void {
  useEffect(() => {
    if (label === '') {
      setState({ label, phase: 'idle' });
      return;
    }
    const problem = localLabelProblem(label);
    if (problem) {
      setState({ label, phase: 'invalid', detail: problem });
      return;
    }
    setState({ label, phase: 'checking' });
    let cancelled = false;
    const timer = setTimeout(() => {
      void checkStageName(label)
        .then((check) => {
          if (cancelled) return;
          if (!check.valid) setState({ label, phase: 'invalid', detail: check.reason });
          else setState({ label, phase: check.available ? 'available' : 'unavailable' });
        })
        .catch((err: unknown) => {
          if (!cancelled) setState({ label, phase: 'failed', detail: errorMessage(err) });
        });
    }, CHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [label]);
}

type Pal = ReturnType<typeof usePalette>;

const STATUS_ICON = 24;
const SHUFFLE_ICON = 16;
const NOOP = (): void => undefined;

interface UsernameInput {
  raw: string;
  setRaw: (raw: string) => void;
  label: string;
  state: ClaimState;
  setState: (next: ClaimState) => void;
}

const FROZEN_PHASES = new Set<ClaimState['phase']>(['claiming', 'claimed']);

export function useUsernameInput(initialLabel = ''): UsernameInput {
  const [raw, setRaw] = useState(initialLabel);
  const [state, setState] = useState<ClaimState>({ label: '', phase: 'idle' });
  const label = normalizeLabel(raw);
  const frozen = FROZEN_PHASES.has(state.phase);
  useNameAvailability(frozen ? state.label : label, frozen ? NOOP : setState);
  return { raw, setRaw, label, state, setState };
}

const SHUFFLE_LABEL = 'Random username';

function ShuffleButton({ pal, disabled, onPick }: { pal: Pal; disabled: boolean; onPick: (label: string) => void }): React.ReactElement {
  return (
    <HoverTooltip label={SHUFFLE_LABEL}>
      <Pressable
        accessibilityLabel={SHUFFLE_LABEL}
        onPress={() => {
          if (!disabled) onPick(randomUsername());
        }}
      >
        <Glyph icon={IconArrowLeftRight} size={SHUFFLE_ICON} color={pal.sub} />
      </Pressable>
    </HoverTooltip>
  );
}

function StatusMark({ state, label, pal }: { state: ClaimState; label: string; pal: Pal }): React.ReactElement | undefined {
  const status = usernameStatus(state, label);
  if (status === null) return undefined;
  if (status.kind === 'checking') return <Spinner size={STATUS_ICON} color={pal.sub} />;
  const ok = status.kind === 'ok';
  return (
    <HoverTooltip label={status.tip}>
      <Column accessible accessibilityLabel={status.tip}>
        <Glyph icon={ok ? IconCircleCheck : IconCircleX} size={STATUS_ICON} color={ok ? pal.success : pal.danger} />
      </Column>
    </HoverTooltip>
  );
}

export function UsernameField({ input, busy }: { input: UsernameInput; busy: boolean }): React.ReactElement {
  const pal = usePalette();
  const { raw, setRaw, label, state } = input;
  return (
    <FormField
      label="Username"
      placeholder="e.g. alice123"
      value={raw}
      onChangeText={(t) => {
        setRaw(sanitizeLabelInput(t));
      }}
      disabled={busy}
      labelTrailing={<ShuffleButton pal={pal} disabled={busy} onPick={setRaw} />}
      inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
      trailing={StatusMark({ state, label, pal })}
      hint={usernameHint(state, label)}
      hintTone={claimStatusTone(state)}
    />
  );
}
