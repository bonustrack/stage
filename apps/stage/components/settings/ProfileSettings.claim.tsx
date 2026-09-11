import { useEffect, useState } from 'react';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Input } from '@stage-labs/kit/react-native/input';
import { fontSize } from '@stage-labs/kit/tokens';
import { Box, Col } from '../layout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { checkStageName, claimStageName, ownedStageName, setPrimaryStageName } from '../../lib/claimName';
import { SettingsButtonRow, SettingsList } from './rows';
import { canClaim, claimStatusText, localLabelProblem, normalizeLabel, type ClaimState } from './ProfileSettings.claim.model';

const CHECK_DEBOUNCE_MS = 400;

function useAvailability(label: string, setState: (next: ClaimState) => void): void {
  useEffect(() => {
    if (label === '') { setState({ label, phase: 'idle' }); return; }
    const problem = localLabelProblem(label);
    if (problem) { setState({ label, phase: 'invalid', detail: problem }); return; }
    setState({ label, phase: 'checking' });
    let cancelled = false;
    const timer = setTimeout(() => {
      void checkStageName(label).then((check) => {
        if (cancelled) return;
        if (!check.valid) setState({ label, phase: 'invalid', detail: check.reason });
        else setState({ label, phase: check.available ? 'available' : 'unavailable' });
      }).catch((err: unknown) => {
        if (!cancelled) setState({ label, phase: 'failed', detail: err instanceof Error ? err.message : String(err) });
      });
    }, CHECK_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [label]);
}

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
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : String(err)); })
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
      {error ? <Caption color="secondary" style={{ paddingHorizontal: 16 }}>{error}</Caption> : null}
    </Col>
  );
}

export function ClaimStageName({ address, onClaimed }: { address: string; onClaimed: () => void }): React.ReactElement {
  const owned = useOwnedLabel(address);
  if (owned !== null) return <SetPrimaryRow address={address} label={owned} onDone={onClaimed} />;
  return <ClaimForm address={address} onClaimed={onClaimed} />;
}

function ClaimForm({ address, onClaimed }: { address: string; onClaimed: () => void }): React.ReactElement {
  const { text: fg, sub, border } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const [raw, setRaw] = useState('');
  const label = normalizeLabel(raw);
  const [state, setState] = useState<ClaimState>({ label: '', phase: 'idle' });
  const busy = state.phase === 'claiming';
  useAvailability(busy || state.phase === 'claimed' ? state.label : label, busy || state.phase === 'claimed' ? () => undefined : setState);

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
        setState({ label, phase: 'failed', detail: err instanceof Error ? err.message : String(err) });
      }
    })();
  };

  return (
    <Col gap={8}>
      <Caption color={fg} style={{ paddingHorizontal: 16 }}>
        CLAIM A FREE NAME
      </Caption>
      <Box padding={{ x: 16 }}>
        <Input
          value={raw}
          onChangeText={setRaw}
          placeholder="yourname"
          placeholderTextColor={sub}
          dark={dark}
          disabled={busy}
          inputType="text"
          style={{ color: fg, borderColor: border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Calibre-Medium', fontSize: fontSize('lg') }}
        />
      </Box>
      <Caption color="secondary" style={{ paddingHorizontal: 16 }}>
        {claimStatusText(state)}
      </Caption>
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
