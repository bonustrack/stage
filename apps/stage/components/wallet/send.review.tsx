import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { Col, Row } from '../layout';
import { shortAddress } from '../../modules/messaging';
import { RecipientRow } from './send.recipient';
import { usePalette } from '../../lib/theme';
import { networkName, recipientSummary, type RecipientState } from './recipient.model';

function ReviewLine({ label, value, secondary }: { label: string; value: string; secondary?: string }): React.ReactElement {
  return (
    <Row align="start" gap={12}>
      <Text value={label} size="md" color="secondary" style={{ flex: 1 }} />
      <Col align="end" gap={2}>
        <Text value={value} size="md" weight="semibold" color="text" />
        {secondary === undefined ? null : <Text value={secondary} size="xs" color="secondary" />}
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
        <Text value="To" size="md" color="secondary" />
        <RecipientRow address={summary.address} label={summary.label} />
        <Col background={border} radius="lg" padding={16} gap={6}>
          <Text value="Full address" size="xs" color="secondary" />
          <Text value={summary.address} size="md" variant="mono" color="text" selectable />
          <Text value="Check every character before you send. Transfers cannot be reversed." size="xs" color="secondary" />
        </Col>
      </Col>
    </Col>
  );
}
