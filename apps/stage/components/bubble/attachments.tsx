
import { capabilities } from '../../lib/capabilities';
import { Card } from '@stage-labs/kit/react-native/card';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { CallAwareVideo as VideoPlayer } from '../CallAwareVideo';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { AudioCard } from './AudioCard';
import { ImageLoading, MessengerImageAttachment } from './ImageAttachment';
import { Col } from '../layout';
import { IconTileRow, MediaCard } from '../MediaCard';
import { useVideoAspectRatio } from './mediaAspect';
import { usePalette } from '../../lib/theme';
import { attachmentPreview, fileCardModel, resolvedAttachmentKind } from './fileCard.model';
import { useLocalAttachment } from '../../lib/localAttachmentCache';
import type { Attachment } from './helpers';
import { useRemoteAttachment } from './attachmentUri';
import { IconFileBend } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFileBend';

function MessengerVideoAttachment({ uri }: { uri: string }): React.ReactElement {
  const { bg } = usePalette();
  const { aspectRatio, onVideoSize } = useVideoAspectRatio(uri);
  return (
    <MediaCard aspectRatio={aspectRatio}>
      <VideoPlayer src={uri} controls background={bg} aspectRatio={aspectRatio} fit="contain" onVideoSize={onVideoSize} />
    </MediaCard>
  );
}

export function AttachmentView({ att, fullUrl, fg, galleryKey }: {
  att: Attachment; fullUrl: string; fg: string; galleryKey?: string;
}): React.ReactElement {
  const kind = resolvedAttachmentKind(att);
  if (kind === 'image') return <MessengerImageAttachment uri={fullUrl} galleryKey={galleryKey} />;
  if (kind === 'video') return <MessengerVideoAttachment uri={fullUrl} />;
  if (kind === 'audio') return <AudioCard att={att} uri={fullUrl} />;
  const card = fileCardModel(att);
  return <AttachmentFile label={card.title} subtitle={card.subtitle} fg={fg} onPress={() => { capabilities.openUrl(fullUrl); }} />;
}

function AttachmentFile({ label, subtitle, fg, onPress, pending = false }: {
  label: string; subtitle?: string; fg: string; onPress?: () => void; pending?: boolean;
}): React.ReactElement {
  const scheme = useKitScheme();
  const { bg } = usePalette();
  return (
    <Card dark={scheme === 'dark'} background={bg} padding={12} onPress={onPress} style={{ width: '100%' }}>
      <IconTileRow
        testID="file-card" title={label} titleColor={fg} subtitle={subtitle}
        icon={pending ? <Spinner size={20} color={fg}/> : <Glyph icon={IconFileBend} size={24} color={fg}/>}
      />
    </Card>
  );
}

function AttachmentRetry({ label, fg, onRetry, compact }: {
  label: string; fg: string; onRetry: () => void; compact: boolean;
}): React.ReactElement {
  if (compact) return <AttachmentFile label={label} subtitle="Tap to retry" fg={fg} onPress={onRetry} />;
  return (
    <MediaCard onPress={onRetry}>
      <Col flex={1} padding={12} align="center" justify="center" gap={8}>
        <Glyph icon={IconFileBend} size={32} color={fg}/>
        <Text size="xs" weight="semibold" color={fg} numberOfLines={2} textAlign="center">{`${label}. Tap to retry`}</Text>
      </Col>
    </MediaCard>
  );
}

function AttachmentPending({ label, fg, compact }: { label: string; fg: string; compact: boolean }): React.ReactElement {
  if (compact) return <AttachmentFile label={label} fg={fg} pending />;
  return (
    <MediaCard>
      <Col flex={1} padding={12} align="center" justify="center" gap={8}>
        <Spinner size={20} color={fg}/>
        <Text size="4xs" role="secondary" numberOfLines={1}>
          {label}
        </Text>
      </Col>
    </MediaCard>
  );
}

export function RemoteAttachmentResolver({ att, fg, msgId, index, galleryKey }: {
  att: Attachment; fg: string;
  msgId?: string; index?: number; galleryKey?: string;
}): React.ReactElement {
  const local = useLocalAttachment(msgId, index, att.remote);
  const remote = useRemoteAttachment(att.remote);
  const { uri, mime } = attachmentPreview(att, local, remote);
  const label = att.name ?? 'attachment';
  const kind = resolvedAttachmentKind(att);
  const compact = kind === 'file';

  if (remote.isError && !local) {
    return <AttachmentRetry label={label} fg={fg} onRetry={remote.retry} compact={compact} />;
  }
  if (!uri && kind === 'image') return <ImageLoading />;
  if (!uri) return <AttachmentPending label={label} fg={fg} compact={compact} />;
  return <AttachmentView att={{ ...att, mime }} fullUrl={uri} fg={fg} galleryKey={galleryKey} />;
}
