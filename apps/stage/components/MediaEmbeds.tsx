
import { capabilities } from '../lib/capabilities';

import { Image } from '@stage-labs/kit/react-native/image';
import { Text, type TextSizeToken } from '@stage-labs/kit/react-native/text';
import { Box } from './layout';
import { MediaCard } from './MediaCard';
import { googleMapsUrl, osmTileUrl } from '@stage-labs/client/embed/detect';
import { usePalette } from '../lib/theme';

export function YouTubeEmbed({ videoId }: { videoId: string }): React.ReactElement {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const thumbUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return (
    <MediaCard onPress={() => { capabilities.openUrl(watchUrl); }}>
      <Box aspectRatio={16 / 9} style={{ position: 'relative' }}>
        <Image
          src={thumbUrl}
          fit="cover"
          style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}
/>
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

export function LocationTile({ lat, lng, pin }: {
  lat: number; lng: number; pin: TextSizeToken;
}): React.ReactElement {
  const tileBg = usePalette().border;
  return (
    <Box aspectRatio={1} style={{ position: 'relative' }}>
      <Image
        src={osmTileUrl(lat, lng, 14)}
        fit="cover"
        style={{ width: '100%', height: '100%', backgroundColor: tileBg }}
/>
      <Box align="center" justify="center" style={{ position: 'absolute', inset: 0 }}>
        <Text size={pin}>📍</Text>
      </Box>
    </Box>
  );
}

export function LocationEmbed({ lat, lng, dark }: {
  lat: number; lng: number; dark: boolean;
}): React.ReactElement {
  const label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  return (
    <MediaCard onPress={() => { capabilities.openUrl(googleMapsUrl(lat, lng)); }}>
      <LocationTile lat={lat} lng={lng} pin="6xl"/>
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
