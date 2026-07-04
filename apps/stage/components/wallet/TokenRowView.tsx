
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Image } from '@stage-labs/kit/react-native/image';
import { Spacer } from '@stage-labs/kit/react-native/spacer';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { changeColor } from '@views';
import { Col, Row } from '../layout';
import { SoftBadge, WalletIcon } from './widgets';

export interface TokenRowViewParams {
  symbol: string;
  name: string;
  priceUsd: string;
  balance: string;
  change24h: string;
  logoUri: string;
  chainBadgeUri?: string;
  isPrivate?: boolean;
  showAvatar?: boolean;
  trailingChevron?: boolean;
}

function TokenRowAvatar({ logoUri, chainBadgeUri }: {
  logoUri: string;
  chainBadgeUri?: string;
}): React.ReactElement {
  if (chainBadgeUri !== undefined) {
    return (
      <Col>
        <Image src={logoUri} size={40} radius="full" />
        <Image src={chainBadgeUri} size={16} radius="full" />
      </Col>
    );
  }
  return <Image src={logoUri} size={40} radius="full" />;
}

export function TokenRowBody(params: TokenRowViewParams): React.ReactElement {
  const scheme = useKitScheme();
  const showAvatar = params.showAvatar !== false;
  const badgeColor = params.change24h.trim().startsWith('-') ? 'danger' : 'success';
  return (
    <Row align="center" gap={12} flex={1}>
      {showAvatar ? (
        <TokenRowAvatar logoUri={params.logoUri} chainBadgeUri={params.chainBadgeUri} />
      ) : null}
      <Col gap={2}>
        <Row align="center" gap={6}>
          {params.isPrivate === true ? (
            <WalletIcon name="shield-check" color="secondary" size={16} />
          ) : null}
          <Text value={params.symbol} weight="semibold" truncate />
        </Row>
        <Caption value={params.name} color="secondary" />
      </Col>
      <Spacer />
      <Col gap={2} align="end">
        <Text value={params.balance} weight="semibold" textAlign="end" />
        <Row gap={4} justify="end" align="center">
          <Caption value={params.priceUsd} color="secondary" />
          <SoftBadge label={params.change24h} color={badgeColor} />
        </Row>
      </Col>
      {params.trailingChevron !== false ? (
        <WalletIcon name="chevron-right" color={changeColor(params.change24h)[scheme]} size={16} />
      ) : null}
    </Row>
  );
}
