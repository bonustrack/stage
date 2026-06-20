/** @file Pure-JS YouTube and OSM location-map embed renderers, both wrapping content in MediaCard from pre-extracted id/coords (detection lives in lib/embedDetect). */

import { Linking } from 'react-native';

import { Image } from '@stage-labs/kit/image';
import { Text } from '@stage-labs/kit/text';
import { Box } from './layout';
import { MediaCard } from './MediaCard';
import { osmTileUrl } from '../lib/embedDetect';
import { usePalette } from '../lib/theme';

/** YouTube preview card: hqdefault thumbnail with a play-button overlay. Tap → opens the YouTube app (or the browser fallback). 16:9 ratio. */
export function YouTubeEmbed({ videoId, dark }: {
  videoId: string; dark: boolean;
}): React.ReactElement {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  /** hqdefault is universally available (mqdefault has missing-frame issues on shorts; maxresdefault 404s when the upload didn't generate one). */
  const thumbUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return (
    <MediaCard dark={dark} onPress={() => void Linking.openURL(watchUrl)}>
      <Box aspectRatio={16 / 9} style={{ position: 'relative' }}>
        <Image
          src={thumbUrl}
          fit="cover"
          style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}
/>
        {/** Play-button overlay — semi-opaque dark scrim + a centered "▶" so the thumbnail reads as "tap to watch" at a glance. */}
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

/** Location preview card: a single OSM tile at zoom 14 centered roughly on the lat/lng (one tile = ~1km wide at z14 in mid-latitudes) with a 📍 emoji overlaid at the center. Tap → opens the source map URL in the device's native maps app. */
export function LocationEmbed({ lat, lng, sourceUrl, dark }: {
  lat: number; lng: number; sourceUrl: string; dark: boolean;
}): React.ReactElement {
  const tileUrl = osmTileUrl(lat, lng, 14);
  const label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  const tileBg = usePalette().border; /** #282a2d / #e4e4e5 (loading placeholder tint) */
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
