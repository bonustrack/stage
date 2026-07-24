
import type { ReactNode } from 'react';
import { GesturePressable } from '@stage-labs/kit/react-native/gesture-pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Text, type TextSizeToken, type TextWeight } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { Title, type TitleSizeToken } from '@stage-labs/kit/react-native/title';
import { resolveColorToken } from '@stage-labs/kit/tokens';
import { Box, Row, WEB_CHROME_LAYER } from '../layout';

export type ScreenHeaderTitleStyle =
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

export interface ScreenHeaderProps {
  title?: string;
  titleStyle?: ScreenHeaderTitleStyle;
  onBack: () => void;
  backColor: string;
  backHitSlop?: number;
  backPadding?: number;
  safeTop?: number;
  padTop?: number;
  padBottom?: number;
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

function BackButton({ onBack, backColor, backHitSlop, backPadding }: {
  onBack: () => void;
  backColor: string;
  backHitSlop?: number;
  backPadding?: number;
}): React.ReactElement {
  const scheme = useKitScheme();
  return (
    <GesturePressable onPress={onBack} hitSlop={backHitSlop ?? 8}>
      <Box padding={backPadding ?? 4}>
        <Icon
          name="arrowLeft"
          size={22}
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
      background={props.surface}
      border={border}
      style={WEB_CHROME_LAYER}
      padding={{
        x: 12,
        top: (props.padTop ?? 8) + (props.safeTop ?? 0),
        bottom: props.padBottom ?? 10,
      }}
    >
      <BackButton
        onBack={props.onBack}
        backColor={props.backColor}
        backHitSlop={props.backHitSlop}
        backPadding={props.backPadding}
      />
      {titled === undefined ? null : (
        <HeaderTitle title={titled.title} titleStyle={titled.titleStyle} />
      )}
      {props.trailing}
    </Row>
  );
}
