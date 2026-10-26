import type { Hex } from 'viem';
import { Button } from '@stage-labs/kit/react-native/button';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { explorerTxUrl } from '@stage-labs/client/xmtp/tx';
import { shortAddress } from '@stage-labs/client/identity/format';
import { DANGER, usePalette } from '../../lib/theme';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { openInBubbleLink } from '../../lib/safeOpenLink';
import { bubbleLinkProps } from '../bubble/linkProps';
import { RecipientRow } from './send.recipient';
import { networkName, recipientSummary, type RecipientState } from './recipient.model';
import type { SendTxState } from './send.public';
import { Column, Row, PAGE_GUTTER } from '../layout';

export function WalletFooter({
  border, dark, onCancel, cancelLabel = 'Cancel', submitLabel, onSubmit, submitDisabled, submitLoading,
}: {
  border: string; dark: boolean;
  onCancel: () => void; cancelLabel?: string;
  submitLabel: string; onSubmit: () => void;
  submitDisabled?: boolean; submitLoading?: boolean;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Row surface="surface" padding={{ x: PAGE_GUTTER, top: 12, bottom: Math.max(insets.bottom, 12) }} gap={12}
      style={{ borderTopWidth: 1, borderTopColor: border }}>
      <Button color="secondary" variant="solid" size="lg" pill dark={dark} style={{ flex: 1 }}
        onPress={onCancel} label={cancelLabel}/>
      <Button variant="primary" size="lg" pill dark={dark} style={{ flex: 1 }}
        loading={!!submitLoading} disabled={!!submitDisabled}
        onPress={onSubmit} label={submitLabel}/>
    </Row>
  );
}

export function TxStatus(props: {
  txState: SendTxState; txHash: Hex | null; txChainId: number; txErr: string | null;
}): React.ReactElement {
  const { txState, txHash, txChainId, txErr } = props;
  return (
    <>
      {txHash ? (
        <Column padding={{ x: 4 }} gap={4}>
          <Text size="3xs" color="secondary">
            {txState === 'confirmed' ? 'Confirmed' : 'Pending'}
          </Text>
          <Pressable {...bubbleLinkProps(explorerTxUrl(txChainId, txHash), openInBubbleLink)} hitSlop={6}>
            <Text size="3xs" color="link">
              {txHash.slice(0, 10)}…{txHash.slice(-8)}
            </Text>
          </Pressable>
        </Column>
      ) : null}
      {txErr ? (
        <Text size="3xs" color={DANGER} style={{ paddingHorizontal: 4 }}>
          {txErr}
        </Text>
      ) : null}
    </>
  );
}

function ReviewLine({ label, value, secondary }: { label: string; value: string; secondary?: string }): React.ReactElement {
  return (
    <Row align="start" gap={12}>
      <Text text={label} size="xs" color="secondary" style={{ flex: 1 }} />
      <Column align="end" gap={2}>
        <Text text={value} size="xs" fontWeight="semibold" color="text" />
        {secondary === undefined ? null : <Text text={secondary} size="3xs" color="secondary" />}
      </Column>
    </Row>
  );
}

export function SendReview({ recipient, amount, symbol, secondaryLabel, chainId }: {
  recipient: RecipientState; amount: string; symbol: string; secondaryLabel?: string; chainId: number;
}): React.ReactElement | null {
  const { border } = usePalette();
  const summary = recipientSummary(recipient, shortAddress);
  if (summary === null) return null;
  return (
    <Column gap={16}>
      <Title level={3}>Confirm send</Title>
      <Column background={border} radius="lg" padding={16} gap={12}>
        <ReviewLine label="Amount" value={`${amount} ${symbol}`} secondary={secondaryLabel} />
        <ReviewLine label="Network" value={networkName(chainId)} />
      </Column>
      <Column gap={8}>
        <Text text="To" size="xs" color="secondary" />
        <RecipientRow address={summary.address} label={summary.label} />
        <Column background={border} radius="lg" padding={16} gap={6}>
          <Text text="Full address" size="3xs" color="secondary" />
          <Text text={summary.address} size="xs" fontFamily="mono" color="text" selectable />
          <Text text="Check every character before you send. Transfers cannot be reversed." size="3xs" color="secondary" />
        </Column>
      </Column>
    </Column>
  );
}
