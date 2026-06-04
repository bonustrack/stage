/** YouTube + location-map embed renderers. Both wrap their content in
 *  `MediaCard` so the visual frame is shared with image/video attachments.
 *  Pure-JS — no native deps — so they ship without an APK rebuild.
 *
 *  Detection happens at the message level via `lib/embedDetect`; this module
 *  only renders given the pre-extracted id/coords. Keeps the bubble simple
 *  and lets the detection logic stay unit-testable. */

import { Image, Linking } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Box } from './layout';
import { MediaCard } from './MediaCard';
import { osmTileUrl } from '../lib/embedDetect';
import { usePalette } from '../lib/theme';

/** YouTube preview card: hqdefault thumbnail with a play-button overlay.
 *  Tap → opens the YouTube app (or the browser fallback). 16:9 ratio. */
export function YouTubeEmbed({ videoId, dark }: {
  videoId: string; dark: boolean;
}): React.ReactElement {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  /** hqdefault is universally available (mqdefault has missing-frame issues
   *  on shorts; maxresdefault 404s when the upload didn't generate one). */
  const thumbUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return (
    <MediaCard dark={dark} onPress={() => void Linking.openURL(watchUrl)}>
      <Box style={{ aspectRatio: 16 / 9, position: 'relative' }}>
        <Image
          source={{ uri: thumbUrl }}
          style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}
          resizeMode="cover"
        />
        {/** Play-button overlay — semi-opaque dark scrim + a centered "▶" so
         *   the thumbnail reads as "tap to watch" at a glance. */}
        <Box style={{
          position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.25)',
        }}>
          <Box style={{
            width: 48, height: 48, borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.7)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: '#ffffff', fontSize: 22, marginLeft: 3 }}>▶</Text>
          </Box>
        </Box>
      </Box>
      <Box style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
        <Text style={{ color: dark ? '#7a7a7e' : '#8a929d', fontSize: 11, fontFamily: 'Calibre-Medium' }}>
          YouTube
        </Text>
      </Box>
    </MediaCard>
  );
}

/** Location preview card: a single OSM tile at zoom 14 centered roughly on
 *  the lat/lng (one tile = ~1km wide at z14 in mid-latitudes) with a 📍
 *  emoji overlaid at the center. Tap → opens the source map URL in the
 *  device's native maps app. */
export function LocationEmbed({ lat, lng, sourceUrl, dark }: {
  lat: number; lng: number; sourceUrl: string; dark: boolean;
}): React.ReactElement {
  const tileUrl = osmTileUrl(lat, lng, 14);
  const label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  const tileBg = usePalette().border; // #282a2d / #e4e4e5 (loading placeholder tint)
  return (
    <MediaCard dark={dark} onPress={() => void Linking.openURL(sourceUrl)}>
      <Box style={{ aspectRatio: 1, position: 'relative' }}>
        <Image
          source={{ uri: tileUrl }}
          style={{ width: '100%', height: '100%', backgroundColor: tileBg }}
          resizeMode="cover"
        />
        <Box style={{
          position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 28 }}>📍</Text>
        </Box>
      </Box>
      <Box style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
        <Text style={{ color: dark ? '#ffffff' : '#000000', fontSize: 12, fontFamily: 'Calibre-Semibold' }}>
          Location
        </Text>
        <Text style={{ color: dark ? '#7a7a7e' : '#8a929d', fontSize: 11, fontFamily: 'Calibre-Medium' }}>
          {label} · tap to open
        </Text>
      </Box>
    </MediaCard>
  );
}
