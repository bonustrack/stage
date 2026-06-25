
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
  dark?: boolean;
}

export function AvatarStack(props: AvatarStackProps): React.ReactElement {
  const { items, size = 32, max = 4, overlap = 10, dark = false } = props;
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  const ring = dark ? '#000000' : '#ffffff';
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
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: dark ? '#3a3c40' : '#d8d8da',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RNText
                style={{
                  color: dark ? '#ffffff' : '#000000',
                  fontSize: size * 0.4,
                  fontFamily: 'Calibre-Semibold',
                }}
              >
                {(item.fallback ?? '?').slice(0, 2)}
              </RNText>
            </View>
          )}
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={{
            marginLeft: -overlap,
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: ring,
            backgroundColor: dark ? '#1c1c1e' : '#f0f0f2',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RNText
            style={{
              color: dark ? '#ffffff' : '#000000',
              fontSize: size * 0.34,
              fontFamily: 'Calibre-Semibold',
            }}
          >
            {`+${extra}`}
          </RNText>
        </View>
      ) : null}
    </View>
  );
}
