import { createContext, useContext, useState } from 'react';
import type { HistoryEntry } from '@stage-labs/client/types';
import { ImageViewer } from '../ImageViewer';
import { useLocalAttachment } from '../../lib/localAttachmentCache';
import { useStableCallback } from '../../lib/useStableCallback';
import { attachmentsOf, type Attachment } from './helpers';
import { inlineAttachmentUrl, useRemoteAttachment } from './attachmentUri';
import { galleryItemsOf, galleryStep, type GalleryItem } from './imageGallery.model';
import { useGalleryKeys } from './galleryKeys';

type ChatImage = GalleryItem<Attachment>;

const ChatGalleryContext = createContext<(() => readonly ChatImage[]) | null>(null);

export function ChatGalleryProvider({ entries, children }: {
  entries: readonly HistoryEntry[];
  children: React.ReactNode;
}): React.ReactElement {
  const images = useStableCallback(() => galleryItemsOf(entries, attachmentsOf));
  return <ChatGalleryContext.Provider value={images}>{children}</ChatGalleryContext.Provider>;
}

function useChatImageUri(image: ChatImage | null): string | null {
  const local = useLocalAttachment(image?.entryId, image?.index);
  const remote = useRemoteAttachment(image?.att.remote);
  if (!image) return null;
  if (local) return local;
  return image.att.remote ? remote.uri ?? '' : inlineAttachmentUrl(image.att);
}

export function ChatImageViewer({ uri, galleryKey, visible, onClose }: {
  uri: string;
  galleryKey?: string;
  visible: boolean;
  onClose: () => void;
}): React.ReactElement {
  const images = useContext(ChatGalleryContext);
  const [shown, setShown] = useState<ChatImage | null>(null);
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) setShown(null);
  }
  const shownUri = useChatImageUri(shown);
  const step = useStableCallback((delta: number) => {
    if (!images || galleryKey === undefined) return;
    const next = galleryStep(images(), shown?.key ?? galleryKey, delta);
    if (next) setShown(next);
  });
  useGalleryKeys(visible && images !== null && galleryKey !== undefined, step);
  return <ImageViewer uri={shownUri ?? uri} visible={visible} onClose={onClose} />;
}
