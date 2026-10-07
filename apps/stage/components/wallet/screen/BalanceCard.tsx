import { useEffect } from 'react';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { BALANCE_TITLE_STYLE, Title } from '@stage-labs/kit/react-native/title';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import type { CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { IconArrowDown } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowDown';
import { IconPaperPlane } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPaperPlane';
import { Box, Col, Row, PAGE_GUTTER } from '../../layout';
import { useHover } from '../../hover';
import { WalletActionButton } from '../../widgets';
import { nextBalanceCurrency, walletBalanceDisplay, type BalanceDisplayInput } from './balance.model';
import { cycleBalanceCurrency } from './currency';

const BALANCE_SPINNER = 28;

const HERO_ACTIONS: readonly (readonly [string, CentralIcon, string])[] = [
  ['Send', IconPaperPlane, 'send'],
  ['Receive', IconArrowDown, 'receive'],
];

function useBalancePulse(active: boolean): ReturnType<typeof useAnimatedStyle> {
  const opacity = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    opacity.value = 1;
    if (active && !reducedMotion) opacity.value = withRepeat(withTiming(0.45, { duration: 800 }), -1, true);
    return (): void => { cancelAnimation(opacity); };
  }, [active, reducedMotion, opacity]);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

export function WalletBalanceCard({ balance, border, onAction }: {
  balance: BalanceDisplayInput; border: string;
  onAction: (action: string) => void;
}): React.ReactElement {
  const hero = walletBalanceDisplay(balance);
  const { hovered, hoverProps } = useHover();
  const label = `Show balance in ${nextBalanceCurrency(balance.currency)}`;
  const pending = balance.refreshing || balance.pricesLoading || (balance.loading && !balance.error);
  const pulse = useBalancePulse(pending);
  const amount = hero.total === '-' ? `${balance.currency} balance unavailable` : `${hero.total}${hero.decimals}${hero.unit}, ${balance.currency} balance`;
  return (
    <Col padding={{ top: PAGE_GUTTER, bottom: 16 }} margin={{ x: PAGE_GUTTER }}>
      <Col gap={12}>
        {hero.spinner ? (
          <Box height={BALANCE_TITLE_STYLE.lineHeight} justify="center" accessibilityRole="progressbar" accessibilityLabel="Loading balance">
            <Spinner size={BALANCE_SPINNER} />
          </Box>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${amount}. ${label}`}
            accessibilityHint="Changes the display currency only"
            aria-busy={pending}
            onPress={cycleBalanceCurrency}
            {...hoverProps}
            style={({ pressed }) => ({ alignSelf: 'flex-start', maxWidth: '100%', opacity: pressed || hovered ? 0.7 : 1 })}
          >
            <Animated.View style={pulse}>
              <Title size="lg" style={BALANCE_TITLE_STYLE}>
                {hero.total}<Title style={BALANCE_TITLE_STYLE} color="secondary">{hero.decimals}</Title>{hero.unit}
              </Title>
            </Animated.View>
          </Pressable>
        )}
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
