import { Text } from '@stage-labs/kit/react-native/text';
import { Box } from '../../components/layout';
import { DANGER } from '../../lib/theme';
import { TxHashLink, type FormPal } from './wallet.form';

type Pal = FormPal;
type Phase = 'idle' | 'proving' | 'broadcasting' | 'done' | 'error';

const shortAddr = (a: string): string => (a.length> 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export function UnshieldRecipient({ pal, eoa, network }: {
  pal: Pal; eoa: string | null; network: string;
}): React.ReactElement {
  const { head, border } = pal;
  return (
    <Box gap={6}>
      <Text size="xs" role="secondary">TO YOUR PUBLIC WALLET</Text>
      <Box surface="raised" radius="lg" padding={{ x: 14, y: 12 }} style={{ borderWidth: 1, borderColor: border }}>
        <Text weight="semibold" size="md" color={head}>
          {eoa ? shortAddr(eoa) : 'Loading address…'}
        </Text>
        <Text size="xs" role="secondary" style={{ marginTop: 2 }}>
          {`Unshields to your own ${network} address.`}
        </Text>
      </Box>
    </Box>
  );
}

export function UnshieldPhaseLine({ phase, txHash, err, bridgeOk, chainId }: {
  phase: Phase; txHash: string | null; err: string | null; bridgeOk: boolean; chainId: number;
}): React.ReactElement | null {
  if (!bridgeOk) {
    return (
      <Text size="xs" role="secondary" style={{ paddingHorizontal: 4 }}>
        Unshielding needs the latest app build.
      </Text>
    );
  }
  return (
    <Box padding={{ x: 4 }} gap={4}>
      {phase === 'proving' ? (
        <Text size="xs" role="secondary">Generating proof… (this can take ~10-30s)</Text>
      ) : phase === 'broadcasting' ? (
        <Text size="xs" role="secondary">Broadcasting…</Text>
      ) : null}
      <TxHashLink chainId={chainId} txHash={txHash} />
      {err ? (
        <Text size="xs" color={DANGER}>{err}</Text>
      ) : null}
    </Box>
  );
}
