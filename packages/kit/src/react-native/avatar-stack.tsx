
import { Text as RNText, View } from 'react-native';
import { AvatarView } from './avatar.view';

export interface AvatarStackEntry {
  src?: string;
  fallback?: string;
}

export interface AvatarStackProps {
  items: AvatarStackEntry[];
  size?: number;
  max?: number;
  overlap?: number;
  ring?: string;
  fallbackBackground?: string;
  moreBackground?: string;
  moreColor?: string;
  moreFontSize?: number;
  moreFontFamily?: string;
  dark?: boolean;
}

function FallbackCell(input: {
  label: string;
  size: number;
  background: string;
  color: string;
}): React.ReactElement {
  return (
    <View
      style={{
        width: input.size,
        height: input.size,
        borderRadius: input.size / 2,
        backgroundColor: input.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <RNText
        style={{
          color: input.color,
          fontSize: input.size * 0.4,
          fontFamily: 'Calibre-Semibold',
        }}
      >
        {input.label.slice(0, 2)}
      </RNText>
    </View>
  );
}

function MoreBadge(input: {
  extra: number;
  size: number;
  overlap: number;
  ring: string;
  background: string;
  color: string;
  fontSize: number;
  fontFamily: string;
}): React.ReactElement {
  return (
    <View
      style={{
        marginLeft: -input.overlap,
        width: input.size,
        height: input.size,
        borderRadius: input.size / 2,
        borderWidth: 2,
        borderColor: input.ring,
        backgroundColor: input.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <RNText
        style={{
          color: input.color,
          fontSize: input.fontSize,
          fontFamily: input.fontFamily,
        }}
      >
        {`+${input.extra}`}
      </RNText>
    </View>
  );
}

interface StackColors {
  ring: string;
  fallbackBg: string;
  fallbackFg: string;
  moreBg: string;
  moreFg: string;
}

function stackColors(props: AvatarStackProps, dark: boolean): StackColors {
  return {
    ring: props.ring ?? (dark ? '#000000' : '#ffffff'),
    fallbackBg: props.fallbackBackground ?? (dark ? '#3a3c40' : '#d8d8da'),
    fallbackFg: dark ? '#ffffff' : '#000000',
    moreBg: props.moreBackground ?? (dark ? '#1c1c1e' : '#f0f0f2'),
    moreFg: props.moreColor ?? (dark ? '#ffffff' : '#000000'),
  };
}

export function AvatarStack(props: AvatarStackProps): React.ReactElement {
  const { items, size = 32, max = 4, overlap = 10, dark = false } = props;
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  const { ring, fallbackBg, fallbackFg, moreBg, moreFg } = stackColors(props, dark);
  const moreSize = props.moreFontSize ?? size * 0.34;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((item, index) => (
        <View
          key={index}
          style={{
            marginLeft: index === 0 ? 0 : -overlap,
            borderRadius: size,
            borderWidth: 2,
            borderColor: ring,
          }}
        >
          {item.src ? (
            <AvatarView src={item.src} size={size} />
          ) : (
            <FallbackCell
              label={item.fallback ?? '?'}
              size={size}
              background={fallbackBg}
              color={fallbackFg}
            />
          )}
        </View>
      ))}
      {extra > 0 ? (
        <MoreBadge
          extra={extra}
          size={size}
          overlap={overlap}
          ring={ring}
          background={moreBg}
          color={moreFg}
          fontSize={moreSize}
          fontFamily={props.moreFontFamily ?? 'Calibre-Semibold'}
        />
      ) : null}
    </View>
  );
}
