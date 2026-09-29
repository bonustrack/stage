import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Title } from '@stage-labs/kit/react-native/title';
import type { CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { IconArrowDown } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowDown';
import { IconPaperPlane } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPaperPlane';
import { Col, Row, PAGE_GUTTER } from '../../layout';
import { HoverTooltip } from '../../HoverTooltip';
import { useHover } from '../../hover';
import { WalletActionButton } from '../../widgets';
import { nextBalanceCurrency, walletBalanceDisplay, type BalanceDisplayInput } from './balance.model';
import { cycleBalanceCurrency } from './currency';

const HERO_ACTIONS: readonly (readonly [string, CentralIcon, string])[] = [
  ['Send', IconPaperPlane, 'send'],
  ['Receive', IconArrowDown, 'receive'],
];

export function WalletBalanceCard({ balance, border, onAction }: {
  balance: BalanceDisplayInput; border: string;
  onAction: (action: string) => void;
}): React.ReactElement {
  const hero = walletBalanceDisplay(balance);
  const { hovered, hoverProps } = useHover();
  const label = `Show balance in ${nextBalanceCurrency(balance.currency)}`;
  const size = balance.currency === 'USD' ? '7xl' : '6xl';
  return (
    <Col padding={{ top: 4, bottom: 16 }} margin={{ x: PAGE_GUTTER }}>
      <Col gap={12}>
        <HoverTooltip label={label} placement="below">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${hero.total}${hero.decimals}${hero.unit}, ${balance.currency} balance. ${label}`}
            accessibilityHint="Changes the display currency only"
            onPress={cycleBalanceCurrency}
            {...hoverProps}
            style={({ pressed }) => ({ alignSelf: 'flex-start', maxWidth: '100%', opacity: pressed || hovered ? 0.7 : 1 })}
          >
            <Title size="lg" hero={size} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
              {hero.total}<Title hero={size} color="secondary">{hero.decimals}</Title>{hero.unit}
            </Title>
          </Pressable>
        </HoverTooltip>
        {hero.subtitle === undefined ? null : <Caption value={hero.subtitle} color="secondary" />}
        <Row gap={12} justify="start">
          {HERO_ACTIONS.map(([label, icon, action]) => (
            <WalletActionButton key={action} label={label} icon={icon} bg={border} onPress={() => { onAction(action); }} />
          ))}
        </Row>
      </Col>
    </Col>
  );
}
