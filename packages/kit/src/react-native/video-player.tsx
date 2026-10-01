import { useEffect, useRef, useState } from 'react';
import { useVideoPlayer, VideoView, type VideoPlayer as ExpoVideoPlayer } from 'expo-video';
import { Image, Platform, View } from 'react-native';

export type VideoFit = 'contain' | 'cover';

export interface VideoSize { width: number; height: number }

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  controls?: boolean;
  background?: string;
  aspectRatio?: number;
  fit?: VideoFit;
  onVideoSize?: (size: VideoSize) => void;
}

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
  const fromTrack = (): void => {
    const size = stopped ? undefined : player.videoTrack?.size;
    if (size) report(size.width, size.height);
  };
  const probe = async (): Promise<void> => {
    try {
      const [frame] = await player.generateThumbnailsAsync(0, SIZE_PROBE);
      if (!frame) { fromTrack(); return; }
      if (!stopped) report(frame.width, frame.height);
      frame.release();
    } catch {
      fromTrack();
    }
  };
  const sub = player.addListener('sourceLoad', () => { void probe(); });
  if (player.status === 'readyToPlay') void probe();
  return () => { stopped = true; sub.remove(); };
}

function useVideoSize(player: ExpoVideoPlayer, frame: React.RefObject<View | null>, onVideoSize?: (size: VideoSize) => void): void {
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

export function VideoPlayer(props: VideoPlayerProps): React.ReactElement {
  const { src, poster, controls = true, background = '#000000', aspectRatio = 16 / 9, fit = 'contain', onVideoSize } = props;
  const player = useVideoPlayer({ uri: src });
  const frame = useRef<View>(null);
  const [showPoster, setShowPoster] = useState(poster !== undefined);
  const [fullscreen, setFullscreen] = useState(false);
  useVideoSize(player, frame, onVideoSize);

  useEffect(() => {
    const sub = player.addListener('playingChange', ({ isPlaying }) => {
      if (isPlaying) setShowPoster(false);
    });
    return () => { sub.remove(); };
  }, [player]);

  return (
    <View
      ref={frame}
      style={{
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: background,
      }}
    >
      <VideoView
        player={player}
        style={{ width: '100%', aspectRatio }}
        nativeControls={controls}
        contentFit={fullscreen ? 'contain' : fit}
        fullscreenOptions={{ enable: true }}
        onFullscreenEnter={() => { setFullscreen(true); }}
        onFullscreenExit={() => { setFullscreen(false); }}
        playsInline
      />
      {poster !== undefined && showPoster ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <Image source={{ uri: poster }} resizeMode={fit} style={{ width: '100%', height: '100%' }} />
        </View>
      ) : null}
    </View>
  );
}
