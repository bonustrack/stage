
import { Linking } from 'react-native';

import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box } from './layout';
import { MediaCard } from './MediaCard';
import { osmTileUrl } from '@stage-labs/client/embed/detect';
import { usePalette } from '../lib/theme';

export function YouTubeEmbed({ videoId, dark }: {
  videoId: string; dark: boolean;
}): React.ReactElement {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const thumbUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return (
    <MediaCard dark={dark} onPress={() => void Linking.openURL(watchUrl)}>
      <Box aspectRatio={16 / 9} style={{ position: 'relative' }}>
        <Image
          src={thumbUrl}
          fit="cover"
          style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}
/>
        {}
        <Box background={'rgba(0,0,0,0.25)'} align="center" justify="center" style={{ position: 'absolute', inset: 0 }}>
          <Box width={48} height={48} radius="full" background={'rgba(0,0,0,0.7)'} align="center" justify="center">
            <Text size="5xl" color={'#ffffff'} style={{ marginLeft: 3 }}>▶</Text>
          </Box>
        </Box>
      </Box>
      <Box padding={{ x: 10, y: 6 }}>
        <Text size="3xs" role="secondary">
          YouTube
        </Text>
      </Box>
    </MediaCard>
  );
}

export function LocationEmbed({ lat, lng, sourceUrl, dark }: {
  lat: number; lng: number; sourceUrl: string; dark: boolean;
}): React.ReactElement {
  const tileUrl = osmTileUrl(lat, lng, 14);
  const label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  const tileBg = usePalette().border;
  return (
    <MediaCard dark={dark} onPress={() => void Linking.openURL(sourceUrl)}>
      <Box aspectRatio={1} style={{ position: 'relative' }}>
        <Image
          src={tileUrl}
          fit="cover"
          style={{ width: '100%', height: '100%', backgroundColor: tileBg }}
/>
        <Box align="center" justify="center" style={{ position: 'absolute', inset: 0 }}>
          <Text size="6xl">📍</Text>
        </Box>
      </Box>
      <Box padding={{ x: 10, y: 6 }}>
        <Text weight="semibold" size="xs" color={dark ? '#ffffff' : '#000000'}>
          Location
        </Text>
        <Text size="3xs" role="secondary">
          {label} · tap to open
        </Text>
      </Box>
    </MediaCard>
  );
}
