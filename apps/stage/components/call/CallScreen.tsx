import { useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { IconCallCancel } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCallCancel';
import { IconMicrophone } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMicrophone';
import { IconMicrophoneOff } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMicrophoneOff';
import { IconPeople } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeople';
import { IconShareScreen } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconShareScreen';
import { IconVideo } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconVideo';
import { IconVideoOff } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconVideoOff';
import type { CallSession } from '@stage-labs/client/xmtp/callMachine';
import { Avatar } from '../Avatar';
import { HoverTooltip } from '../HoverTooltip';
import { Box, Col, Row, PAGE_GUTTER, viewportFill } from '../layout';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useWebTabRail } from '../../lib/webLayout';
import { leaveCall, screenShareSupported, toggleCamera, toggleMic, toggleScreen } from '../../lib/calls';
import type { CallLinkStatus, CallMedia, CallView } from '../../lib/calls.store';
import { ignore } from '../../lib/errorPolicy';
import { CallMediaView } from './CallMediaView';
import { CallScreenPicker } from './CallScreenPicker';
import type { CallStream } from '../../lib/calls.types';
import { callPerson, callTitle } from './callPeople';
import { TitleText } from '../TitleText';
import { callGrid, callSubtitle } from './CallScreen.model';

interface TileData {
  key: string;
  inboxId: string;
  stream: CallStream | null;
  media: CallMedia;
  status: CallLinkStatus;
  self: boolean;
}

const STATUS_TEXT: Record<CallLinkStatus, string | null> = {
  connecting: 'Connecting…',
  connected: null,
  failed: 'Could not connect',
};

function tilesOf(view: CallView, session: CallSession): TileData[] {
  const self: TileData = {
    key: 'self', inboxId: view.selfInboxId ?? '', stream: view.preview, media: view.media, status: 'connected', self: true,
  };
  const others = view.peers.map((p): TileData => ({
    key: p.peerId, inboxId: p.inboxId, stream: p.stream, media: p.media, status: p.status, self: false,
  }));
  return session.phase === 'joined' ? [self, ...others] : others;
}

function Tile({ tile, convId, selfInboxId, width, height }: {
  tile: TileData; convId: string; selfInboxId: string | null; width: string; height: string;
}): React.ReactElement {
  const { border } = usePalette();
  const person = callPerson(convId, tile.inboxId, selfInboxId);
  const status = STATUS_TEXT[tile.status];
  const showVideo = tile.media.video && tile.stream !== null;
  return (
    <Box style={{ width: width as `${number}%`, height: height as `${number}%` }} padding={4}>
      <Box flex={1} radius={12} background={border} align="center" justify="center" style={{ overflow: 'hidden' }}>
        {showVideo
          ? <CallMediaView stream={tile.stream} kind="video" mirrored={tile.self && !tile.media.screen} contain={tile.media.screen}/>
          : <Avatar address={person.address} size={72}/>}
        <Row align="center" gap={6} padding={{ x: 10, y: 6 }} style={{ position: 'absolute', left: 8, bottom: 8 }} background="#00000099" radius={8}>
          {tile.media.audio ? null : <Glyph icon={IconMicrophoneOff} size={14} color="#ffffff"/>}
          <Text size="xs" color="#ffffff" value={status ? `${person.name} · ${status}` : person.name} maxLines={1}/>
        </Row>
      </Box>
    </Box>
  );
}

function Control({ icon, label, active, danger, onPress }: {
  icon: CentralIcon; label: string; active: boolean; danger?: boolean; onPress: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { link, bg, danger: red } = usePalette();
  const fg = danger === true || active ? bg : link;
  return (
    <HoverTooltip label={label} placement="above">
      <Button
        size="xl" uniform pill dark={dark} accessibilityLabel={label} aria-pressed={active}
        color="secondary" variant={active || danger === true ? 'solid' : 'soft'}
        tintBg={danger === true ? red : active ? link : undefined}
        icon={<Glyph icon={icon} size={22} color={fg}/>} onPress={onPress}
      />
    </HoverTooltip>
  );
}

function Controls({ media, people, onPeople }: { media: CallMedia; people: boolean; onPeople: () => void }): React.ReactElement {
  const bottom = useSafeAreaInsets().bottom;
  return (
    <Row align="center" justify="center" gap={14} padding={{ top: 12, bottom: 16 + bottom, x: PAGE_GUTTER }} wrap>
      <Control icon={media.audio ? IconMicrophone : IconMicrophoneOff} label={media.audio ? 'Mute' : 'Unmute'} active={!media.audio} onPress={toggleMic}/>
      <Control
        icon={media.video && !media.screen ? IconVideo : IconVideoOff} label={media.video && !media.screen ? 'Turn camera off' : 'Turn camera on'}
        active={media.video && !media.screen} onPress={() => { ignore(toggleCamera(), 'ui'); }}
      />
      {screenShareSupported ? (
        <Control icon={IconShareScreen} label={media.screen ? 'Stop sharing' : 'Share screen'} active={media.screen} onPress={() => { ignore(toggleScreen(), 'ui'); }}/>
      ) : null}
      <Control icon={IconPeople} label="Participants" active={people} onPress={onPeople}/>
      <Control icon={IconCallCancel} label="Leave call" active={false} danger onPress={leaveCall}/>
    </Row>
  );
}

function Participants({ tiles, convId, selfInboxId }: { tiles: TileData[]; convId: string; selfInboxId: string | null }): React.ReactElement {
  const { border } = usePalette();
  return (
    <Col width={260} gap={12} padding={16} style={{ borderLeftWidth: 1, borderLeftColor: border }}>
      <Text size="sm" weight="semibold" value={`In this call (${tiles.length})`}/>
      {tiles.map((t) => {
        const person = callPerson(convId, t.inboxId, selfInboxId);
        return (
          <Row key={t.key} align="center" gap={10}>
            <Avatar address={person.address} size={28}/>
            <Text size="xs" value={person.name} maxLines={1} style={{ flex: 1 }}/>
            {t.media.audio ? null : <Glyph icon={IconMicrophoneOff} size={16}/>}
            {t.media.screen ? <Glyph icon={IconShareScreen} size={16}/> : null}
          </Row>
        );
      })}
    </Col>
  );
}

export function CallScreen({ view, session }: { view: CallView; session: CallSession }): React.ReactElement {
  const wide = useWebTabRail();
  const [people, setPeople] = useState(false);
  const tiles = tilesOf(view, session);
  const { cols, rows } = callGrid(tiles.length, wide);
  const connected = view.peers.filter((p) => p.status === 'connected').length;
  const top = useSafeAreaInsets().top;
  return (
    <Col surface="surface" style={viewportFill(60)}>
      <CallScreenPicker/>
      <Col padding={{ top: 14 + top, bottom: 10, x: PAGE_GUTTER }}>
        <TitleText weight="semibold" size="md" title={callTitle(session.convId)} maxLines={1}/>
        <Text size="xs" role="secondary" value={callSubtitle(connected, Date.now() - session.startedMs)}/>
      </Col>
      <Row flex={1}>
        <Row flex={1} wrap padding={{ x: 8 }}>
          {tiles.map((t) => (
            <Tile key={t.key} tile={t} convId={session.convId} selfInboxId={view.selfInboxId} width={`${100 / cols}%`} height={`${100 / rows}%`}/>
          ))}
        </Row>
        {people ? <Participants tiles={tiles} convId={session.convId} selfInboxId={view.selfInboxId}/> : null}
      </Row>
      {view.peers.map((p) => <CallMediaView key={p.peerId} stream={p.stream} kind="audio"/>)}
      <Controls media={view.media} people={people} onPeople={() => { setPeople(!people); }}/>
    </Col>
  );
}
