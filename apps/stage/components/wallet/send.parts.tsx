import type { Hex } from 'viem';
import { Button } from '@stage-labs/kit/react-native/button';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { explorerTxUrl } from '@stage-labs/client/xmtp/tx';
import { Box, Col, Row, PAGE_GUTTER } from '../layout';
import { shortAddress } from '@stage-labs/client/identity/format';
import { DANGER, usePalette } from '../../lib/theme';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { openInBubbleLink } from '../../lib/safeOpenLink';
import { bubbleLinkProps } from '../bubble/linkProps';
import { RecipientRow } from './send.recipient';
import { networkName, recipientSummary, type RecipientState } from './recipient.model';

type TxState = 'idle' | 'submitting' | 'pending' | 'confirmed';

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
      <Button size="lg" pill dark={dark} style={{ flex: 1 }}
        loading={!!submitLoading} disabled={!!submitDisabled}
        onPress={onSubmit} label={submitLabel}/>
    </Row>
  );
}

export function TxStatus(props: {
  txState: TxState; txHash: Hex | null; txChainId: number; txErr: string | null;
}): React.ReactElement {
  const { txState, txHash, txChainId, txErr } = props;
  return (
    <>
      {txHash ? (
        <Box padding={{ x: 4 }} gap={4}>
          <Text size="4xs" role="secondary">
            {txState === 'confirmed' ? 'Confirmed' : 'Pending'}
          </Text>
          <Pressable {...bubbleLinkProps(explorerTxUrl(txChainId, txHash), openInBubbleLink)} hitSlop={6}>
            <Text size="4xs" role="link">
              {txHash.slice(0, 10)}…{txHash.slice(-8)}
            </Text>
          </Pressable>
        </Box>
      ) : null}
      {txErr ? (
        <Text size="4xs" color={DANGER} style={{ paddingHorizontal: 4 }}>
          {txErr}
        </Text>
      ) : null}
    </>
  );
}

function ReviewLine({ label, value, secondary }: { label: string; value: string; secondary?: string }): React.ReactElement {
  return (
    <Row align="start" gap={12}>
      <Text value={label} size="2xs" color="secondary" style={{ flex: 1 }} />
      <Col align="end" gap={2}>
        <Text value={value} size="2xs" weight="semibold" color="text" />
        {secondary === undefined ? null : <Text value={secondary} size="4xs" color="secondary" />}
      </Col>
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
    <Col gap={16}>
      <Title level={3}>Confirm send</Title>
      <Col background={border} radius="lg" padding={16} gap={12}>
        <ReviewLine label="Amount" value={`${amount} ${symbol}`} secondary={secondaryLabel} />
        <ReviewLine label="Network" value={networkName(chainId)} />
      </Col>
      <Col gap={8}>
        <Text value="To" size="2xs" color="secondary" />
        <RecipientRow address={summary.address} label={summary.label} />
        <Col background={border} radius="lg" padding={16} gap={6}>
          <Text value="Full address" size="4xs" color="secondary" />
          <Text value={summary.address} size="2xs" variant="mono" color="text" selectable />
          <Text value="Check every character before you send. Transfers cannot be reversed." size="4xs" color="secondary" />
        </Col>
      </Col>
    </Col>
  );
}
