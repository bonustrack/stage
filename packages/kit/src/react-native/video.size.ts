import { useEffect } from 'react';
import { Platform, type View } from 'react-native';
import type { VideoPlayer as ExpoVideoPlayer } from 'expo-video';

export interface VideoSize { width: number; height: number }

const SIZE_PROBE = { maxWidth: 320, maxHeight: 320 };

function webVideoOf(frame: View | null): HTMLVideoElement | null {
  return frame ? (frame as unknown as HTMLElement).querySelector('video') : null;
}

function watchWebVideo(video: HTMLVideoElement, report: (width: number, height: number) => void): () => void {
  const read = (): void => { report(video.videoWidth, video.videoHeight); };
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) read();
  video.addEventListener('loadedmetadata', read);
  return () => { video.removeEventListener('loadedmetadata', read); };
}

function watchNativeVideo(player: ExpoVideoPlayer, report: (width: number, height: number) => void): () => void {
  let stopped = false;
  let probed = false;
  const fromTrack = (): void => {
    const size = stopped ? undefined : player.videoTrack?.size;
    if (size) report(size.width, size.height);
  };
  const probe = async (): Promise<void> => {
    if (probed || stopped) return;
    probed = true;
    try {
      const [frame] = await player.generateThumbnailsAsync(0, SIZE_PROBE);
      if (!frame) { fromTrack(); return; }
      if (!stopped) report(frame.width, frame.height);
      frame.release();
    } catch {
      fromTrack();
    }
  };
  const loaded = player.addListener('sourceLoad', () => { void probe(); });
  const ready = player.addListener('statusChange', ({ status }) => { if (status === 'readyToPlay') void probe(); });
  if (player.status === 'readyToPlay') void probe();
  return () => { stopped = true; loaded.remove(); ready.remove(); };
}

export function useVideoSize(player: ExpoVideoPlayer, frame: React.RefObject<View | null>, onVideoSize?: (size: VideoSize) => void): void {
  useEffect(() => {
    if (!onVideoSize) return undefined;
    const report = (width: number, height: number): void => {
      if (width > 0 && height > 0) onVideoSize({ width, height });
    };
    if (Platform.OS !== 'web') return watchNativeVideo(player, report);
    const video = webVideoOf(frame.current);
    return video ? watchWebVideo(video, report) : undefined;
  }, [player, frame, onVideoSize]);
}
