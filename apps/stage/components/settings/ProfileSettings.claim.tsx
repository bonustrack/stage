import { errorMessage } from '@stage-labs/client/errors';
import { useEffect, useState } from 'react';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Col } from '../layout';
import { FormField } from '../FormField';
import { usePalette } from '../../lib/theme';
import { claimStageName, ownedStageName, setPrimaryStageName } from '../../lib/claimName';
import { useNameAvailability } from './useNameAvailability';
import { SettingsButtonRow, SettingsList } from './rows';
import { canClaim, claimStatusText, normalizeLabel, sanitizeLabelInput, type ClaimState } from './ProfileSettings.claim.model';

function useOwnedLabel(address: string): string | null {
  const [owned, setOwned] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void ownedStageName(address).then((name) => {
      if (!cancelled) setOwned(name ? name.replace(/\.stage\.base\.eth$/, '') : null);
    });
    return () => { cancelled = true; };
  }, [address]);
  return owned;
}

function SetPrimaryRow({ address, label, onDone }: { address: string; label: string; onDone: () => void }): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (): void => {
    if (busy) return;
    setBusy(true);
    setPrimaryStageName(address, label)
      .then(onDone)
      .catch((err: unknown) => { setError(errorMessage(err)); })
      .finally(() => { setBusy(false); });
  };
  return (
    <Col gap={8}>
      <SettingsList>
        <SettingsButtonRow
          label={busy ? 'Setting primary name…' : `Use ${label}.stage.base.eth as my name`}
          description="You already claimed this name. One signature makes it your primary name."
          onPress={run}
        />
      </SettingsList>
      {error ? <Box padding={{ x: 16 }}><Text value={error} size="md" color="secondary" /></Box> : null}
    </Col>
  );
}

export function ClaimStageName({ address, onClaimed }: { address: string; onClaimed: () => void }): React.ReactElement {
  const owned = useOwnedLabel(address);
  if (owned !== null) return <SetPrimaryRow address={address} label={owned} onDone={onClaimed} />;
  return <ClaimForm address={address} onClaimed={onClaimed} />;
}

function ClaimForm({ address, onClaimed }: { address: string; onClaimed: () => void }): React.ReactElement {
  const { text: fg } = usePalette();
  const [raw, setRaw] = useState('');
  const label = normalizeLabel(raw);
  const [state, setState] = useState<ClaimState>({ label: '', phase: 'idle' });
  const busy = state.phase === 'claiming';
  useNameAvailability(busy || state.phase === 'claimed' ? state.label : label, busy || state.phase === 'claimed' ? () => undefined : setState);

  const claim = (): void => {
    if (!canClaim(state)) return;
    setState({ label, phase: 'claiming' });
    void (async (): Promise<void> => {
      try {
        await claimStageName(label);
        await setPrimaryStageName(address, label);
        setState({ label, phase: 'claimed' });
        onClaimed();
      } catch (err) {
        setState({ label, phase: 'failed', detail: errorMessage(err) });
      }
    })();
  };

  return (
    <Col gap={8}>
      <Caption color={fg} style={{ paddingHorizontal: 16 }}>
        CLAIM A FREE NAME
      </Caption>
      <Box padding={{ x: 16 }}>
        <FormField label="Username" placeholder="yourname" value={raw} onChangeText={(t) => { setRaw(sanitizeLabelInput(t)); }} disabled={busy}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false }} hint={claimStatusText(state)} />
      </Box>
      <SettingsList>
        <SettingsButtonRow
          label={busy ? 'Claiming…' : `Claim ${label === '' ? 'name' : `${label}.stage.base.eth`}`}
          description="Free. Stage pays the network fee. You sign once to prove the address is yours."
          onPress={claim}
        />
      </SettingsList>
    </Col>
  );
}
