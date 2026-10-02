import { useState } from 'react';
import { Card } from '@stage-labs/kit/react-native/card';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { useAudioPlayback } from '@stage-labs/kit/react-native/audio-player';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { IconAudio } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconAudio';
import { IconCloudDownload } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCloudDownload';
import { IconMicrophone } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMicrophone';
import { IconPause } from '@central-icons-react-native/round-filled-radius-1-stroke-2/IconPause';
import { IconPlay } from '@central-icons-react-native/round-filled-radius-1-stroke-2/IconPlay';
import { Box, Col, Row } from '../layout';
import { HoverTooltip } from '../HoverTooltip';
import { useHover } from '../hover';
import { usePalette } from '../../lib/theme';
import { report } from '../../lib/errorPolicy';
import { capabilities } from '../../lib/capabilities';
import { downloadFile } from '../../lib/fileDownload';
import { SEEK_THUMB } from '../../lib/uiColors';
import { callOwnsAudio } from '../../lib/calls.audio.core';
import { AudioSeekBar } from './AudioSeekBar';
import { audioCardModel } from './audioCard.model';
import { ATTACHMENT_MAX_WIDTH } from './imageBox.model';
import type { Attachment } from './helpers';

function CardIconButton({ icon, label, color, onPress }: {
  icon: CentralIcon; label: string; color: string; onPress: () => void;
}): React.ReactElement {
  const { link } = usePalette();
  const { hovered, hoverProps } = useHover();
  return (
    <HoverTooltip label={label}>
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} {...hoverProps}>
        <Glyph icon={icon} size={20} color={hovered ? link : color}/>
      </Pressable>
    </HoverTooltip>
  );
}

function useDownload(uri: string, name: string, mime?: string): () => void {
  const [saving, setSaving] = useState(false);
  return () => {
    if (saving) return;
    setSaving(true);
    void downloadFile(uri, name, mime)
      .catch((e: unknown) => { report('audio.download', e); capabilities.toast('Download failed'); })
      .finally(() => { setSaving(false); });
  };
}

export function AudioCard({ att, uri }: { att: Attachment; uri: string }): React.ReactElement {
  const scheme = useKitScheme();
  const pal = usePalette();
  const { playing, position, duration, toggle, seek } = useAudioPlayback(uri, { preload: true });
  const [scrub, setScrub] = useState<number | null>(null);
  const shown = scrub === null ? position : scrub * duration;
  const model = audioCardModel(att, { position: shown, duration });
  const download = useDownload(uri, model.fileName, att.mime);

  return (
    <Card dark={scheme === 'dark'} background={pal.bg} padding={12} style={{ width: '100%', maxWidth: ATTACHMENT_MAX_WIDTH }}>
      <Col testID="audio-card" gap={8}>
        <Row align="center" gap={12}>
          <Box width={44} height={44} radius="md" align="center" justify="center" surface="raised">
            <Glyph icon={model.voice ? IconMicrophone : IconAudio} size={24} color={pal.text}/>
          </Box>
          <Col flex={1} minWidth={0} gap={2}>
            <Text size="2xs" weight="semibold" color={pal.text} numberOfLines={1}>{model.title}</Text>
            {model.subtitle ? <Text size="3xs" role="secondary" numberOfLines={1}>{model.subtitle}</Text> : null}
          </Col>
          <CardIconButton icon={IconCloudDownload} label="Download" color={pal.sub} onPress={download}/>
        </Row>
        <Row align="center" gap={12}>
          <CardIconButton icon={playing ? IconPause : IconPlay} label={playing ? 'Pause' : 'Play'} color={pal.text} onPress={() => { if (callOwnsAudio()) capabilities.toast('Leave the call before playing audio.'); else void toggle(); }}/>
          <AudioSeekBar
            progress={model.progress}
            enabled={duration > 0}
            label={`Seek ${model.title}`}
            colors={{ track: pal.border, fill: pal.text, thumb: SEEK_THUMB[scheme], thumbBorder: pal.border }}
            onScrub={setScrub}
            onSeek={seek}
          />
          <Text size="3xs" role="secondary" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>{model.time}</Text>
        </Row>
      </Col>
    </Card>
  );
}
