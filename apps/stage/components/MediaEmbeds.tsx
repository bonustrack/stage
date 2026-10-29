import { useMemo } from 'react';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { colors } from '@stage-labs/kit/tokens';
import { MediaCard } from './MediaCard';
import { googleMapsUrl, osmTileGrid, type MapView } from '@stage-labs/client/embed/detect';
import { usePalette, withAlpha } from '../lib/theme';
import { Column, Row } from './layout';

const LETTERBOX_CROP = 4 / 3;

export function YouTubeEmbed({ videoId }: { videoId: string }): React.ReactElement {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const thumbUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const { bg } = usePalette();
  return (
    <MediaCard url={watchUrl}>
      <Column weight={1} style={{ position: 'relative', overflow: 'hidden' }}>
        <Image
          url={thumbUrl}
          fit="cover"
          style={{ width: '100%', height: '100%', backgroundColor: bg, transform: [{ scale: LETTERBOX_CROP }] }}
        />
        <Column background={'rgba(0,0,0,0.25)'} align="center" justify="center" style={{ position: 'absolute', inset: 0 }}>
          <Column width={48} height={48} radius="full" background={'rgba(0,0,0,0.7)'} align="center" justify="center">
            <Text size="2xl" color={'#ffffff'} style={{ marginLeft: 3 }}>
              ▶
            </Text>
          </Column>
        </Column>
      </Column>
      <Column padding={{ x: 10, y: 6 }}>
        <Text color="secondary" size="3xs">
          YouTube
        </Text>
      </Column>
    </MediaCard>
  );
}

type MapSize = 'sm' | 'lg';

const MAP_VIEWS: Record<MapSize, MapView> = { sm: { zoom: 15, width: 144, height: 144 }, lg: { zoom: 15, width: 512, height: 512 } };

const PIN_SIZE: Record<MapSize, number> = { sm: 16, lg: 26 };

const TILE_HEADERS = { 'User-Agent': 'Stage (+https://stage.box)' };

function MapPin({ size }: { size: number }): React.ReactElement {
  const lift = size / Math.SQRT2;
  const dot = Math.round(size * 0.36);
  return (
    <>
      <Column
        width={size}
        height={size}
        background={colors['head-light']}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          borderRadius: size / 2,
          borderBottomRightRadius: 0,
          borderWidth: 2,
          borderColor: colors['bg-light'],
          transform: [{ translateX: -size / 2 }, { translateY: -size / 2 - lift }, { rotate: '45deg' }],
        }}
      />
      <Column
        width={dot}
        height={dot}
        radius="full"
        background={colors['bg-light']}
        style={{ position: 'absolute', left: '50%', top: '50%', transform: [{ translateX: -dot / 2 }, { translateY: -dot / 2 - lift }] }}
      />
    </>
  );
}

function MapAttribution(): React.ReactElement {
  return (
    <Column
      padding={{ x: 4 }}
      background={withAlpha(colors['bg-light'], 0.75)}
      style={{ position: 'absolute', right: 0, bottom: 0, borderTopLeftRadius: 4 }}
    >
      <Text color={colors['fg-light']} size="3xs">
        © OpenStreetMap
      </Text>
    </Column>
  );
}

export function LocationTile({ lat, lng, size }: { lat: number; lng: number; size: MapSize }): React.ReactElement {
  const tileBg = usePalette().bg;
  const view = MAP_VIEWS[size];
  const tiles = useMemo(() => osmTileGrid(lat, lng, view), [lat, lng, view]);
  return (
    <Column width="100%" aspectRatio={view.width / view.height} background={tileBg} style={{ position: 'relative', overflow: 'hidden' }}>
      {tiles.map((tile) => (
        <Image
          key={tile.url}
          url={tile.url}
          headers={TILE_HEADERS}
          fit="fill"
          style={{ position: 'absolute', left: `${tile.left}%`, top: `${tile.top}%`, width: `${tile.width}%`, height: `${tile.height}%` }}
        />
      ))}
      <MapPin size={PIN_SIZE[size]} />
    </Column>
  );
}

export function LocationEmbed({ lat, lng, dark }: { lat: number; lng: number; dark: boolean }): React.ReactElement {
  return (
    <MediaCard url={googleMapsUrl(lat, lng)}>
      <Column weight={1} justify="center" style={{ overflow: 'hidden' }}>
        <LocationTile lat={lat} lng={lng} size="lg" />
        <MapAttribution />
      </Column>
      <Row padding={{ x: 10, y: 8 }} align="center" justify="spaceBetween" gap={8}>
        <Text fontWeight="semibold" size="3xs" color={dark ? '#ffffff' : '#000000'}>
          Location
        </Text>
        <Text color="secondary" numberOfLines={1} size="3xs">
          Open in Google Maps
        </Text>
      </Row>
    </MediaCard>
  );
}
