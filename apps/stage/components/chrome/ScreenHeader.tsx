
import type { ReactNode } from 'react';
import { GesturePressable } from '@stage-labs/kit/react-native/gesture-pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Text, type TextSizeToken, type TextWeight } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { Title, type TitleSizeToken } from '@stage-labs/kit/react-native/title';
import { resolveColorToken } from '@stage-labs/kit/tokens';
import { Box, Row, STICKY_TOP } from '../layout';

type ScreenHeaderTitleStyle =
  | {
      kind: 'text';
      size?: TextSizeToken;
      weight?: TextWeight;
      color?: string;
      truncate?: boolean;
      maxLines?: number;
    }
  | {
      kind: 'title';
      size?: TitleSizeToken;
      color?: string;
    };

interface ScreenHeaderProps {
  title?: string;
  titleStyle?: ScreenHeaderTitleStyle;
  onBack: () => void;
  backColor: string;
  safeTop?: number;
  padTop?: number;
  padBottom?: number;
  minHeight?: number;
  surface?: string;
  borderColor?: string;
  trailing?: ReactNode;
}

function HeaderTitle({ title, titleStyle }: {
  title: string;
  titleStyle: ScreenHeaderTitleStyle;
}): React.ReactElement {
  if (titleStyle.kind === 'title') {
    return (
      <Title size={titleStyle.size} color={titleStyle.color}>
        {title}
      </Title>
    );
  }
  return (
    <Text
      value={title}
      size={titleStyle.size}
      weight={titleStyle.weight}
      color={titleStyle.color}
      truncate={titleStyle.truncate}
      maxLines={titleStyle.maxLines}
    />
  );
}

export function BackButton({ onBack, backColor, hitSlop = 8, padding = 4 }: {
  onBack: () => void;
  backColor: string;
  hitSlop?: number;
  padding?: number;
}): React.ReactElement {
  const scheme = useKitScheme();
  return (
    <GesturePressable onPress={onBack} hitSlop={hitSlop}>
      <Box padding={padding}>
        <Icon
          name="arrowNarrowLeft"
          size={24}
          color={resolveColorToken(backColor, scheme)}
          dark={scheme === 'dark'}
        />
      </Box>
    </GesturePressable>
  );
}

function headerTitled(props: ScreenHeaderProps): { title: string; titleStyle: ScreenHeaderTitleStyle } | undefined {
  if (props.title === undefined || props.title === '') return undefined;
  if (props.titleStyle === undefined) return undefined;
  return { title: props.title, titleStyle: props.titleStyle };
}

export function ScreenHeader(props: ScreenHeaderProps): React.ReactElement {
  const scheme = useKitScheme();
  const titled = headerTitled(props);
  const border =
    props.borderColor === undefined
      ? undefined
      : { bottom: { width: 1, color: resolveColorToken(props.borderColor, scheme) } };
  return (
      <Row
        align="center"
        justify={titled === undefined ? 'between' : undefined}
        gap={8}
        minHeight={props.minHeight}
        background={props.surface}
        border={border}
        style={STICKY_TOP}
        padding={{
          x: 12,
          top: (props.padTop ?? 8) + (props.safeTop ?? 0),
          bottom: props.padBottom ?? 10,
        }}
      >
        <BackButton onBack={props.onBack} backColor={props.backColor} />
        {titled === undefined ? null : (
          <HeaderTitle title={titled.title} titleStyle={titled.titleStyle} />
        )}
        {props.trailing}
      </Row>
  );
}
