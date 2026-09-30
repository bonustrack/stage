
import { capabilities } from '../../lib/capabilities';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { VideoPlayer } from '@stage-labs/kit/react-native/video-player';
import { Spinner } from '../Spinner';
import { AudioCard } from './AudioCard';
import { MessengerImageAttachment } from './ImageAttachment';
import { Col } from '../layout';
import { MediaCard } from '../MediaCard';
import { usePalette } from '../../lib/theme';
import { fileCardModel } from './fileCard.model';
import { useLocalAttachment } from '../../lib/localAttachmentCache';
import type { Attachment } from './helpers';
import { useRemoteAttachment } from './attachmentUri';
import { resolvedAttachmentKind } from './attachmentKind.model';
import { IconFileBend } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFileBend';

function MessengerVideoAttachment({ uri }: { uri: string }): React.ReactElement {
  const { bg } = usePalette();
  return (
    <MediaCard>
      <VideoPlayer src={uri} controls background={bg} aspectRatio={1} fit="cover" />
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

function AttachmentFile({ label, subtitle, fg, onPress }: {
  label: string; subtitle?: string; fg: string; onPress: () => void;
}): React.ReactElement {
  return (
    <MediaCard onPress={onPress}>
      <Col flex={1} padding={12} align="center" justify="center" gap={8}>
        <Glyph icon={IconFileBend} size={32} color={fg}/>
        <Text weight="semibold" color={fg} numberOfLines={2} textAlign="center">{label}</Text>
        {subtitle ? <Text size="sm" role="secondary" numberOfLines={1}>{subtitle}</Text> : null}
      </Col>
    </MediaCard>
  );
}

function AttachmentRetry({ label, fg, onRetry }: {
  label: string; fg: string; onRetry: () => void;
}): React.ReactElement {
  return <AttachmentFile label={`${label}. Tap to retry`} fg={fg} onPress={onRetry} />;
}

function AttachmentPending({ label, fg }: { label: string; fg: string }): React.ReactElement {
  return (
    <MediaCard>
      <Col flex={1} padding={12} align="center" justify="center" gap={8}>
        <Spinner size={20} color={fg}/>
        <Text size="xs" role="secondary" numberOfLines={1}>
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
  const local = useLocalAttachment(msgId, index);
  const remote = useRemoteAttachment(att.remote);
  const uri = local ?? remote.uri;
  const label = att.name ?? 'attachment';

  if (remote.isError && !local) {
    return <AttachmentRetry label={label} fg={fg} onRetry={remote.retry} />;
  }
  if (!uri) return <AttachmentPending label={label} fg={fg} />;
  return <AttachmentView att={{ ...att, mime: remote.mime ?? att.mime }} fullUrl={uri} fg={fg} galleryKey={galleryKey} />;
}
