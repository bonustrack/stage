import { useEffect, useRef, useState } from 'react';
import { useVideoPlayer, VideoView, type VideoPlayer as ExpoVideoPlayer } from 'expo-video';
import { Image, Platform, View } from 'react-native';
import { BLOCK_RADIUS_DEFAULT } from '../tokens';
import { accessibilityProps, weightStyle, type A2uiCommonProps } from './a2ui-props';

export type VideoFit = 'contain' | 'cover';

export interface VideoSize {
  width: number;
  height: number;
}

export interface VideoProps extends A2uiCommonProps {
  url: string;
  posterUrl?: string;
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
  const read = (): void => {
    report(video.videoWidth, video.videoHeight);
  };
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) read();
  video.addEventListener('loadedmetadata', read);
  return () => {
    video.removeEventListener('loadedmetadata', read);
  };
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
      if (!frame) {
        fromTrack();
        return;
      }
      if (!stopped) report(frame.width, frame.height);
      frame.release();
    } catch {
      fromTrack();
    }
  };
  const loaded = player.addListener('sourceLoad', () => {
    void probe();
  });
  const ready = player.addListener('statusChange', ({ status }) => {
    if (status === 'readyToPlay') void probe();
  });
  if (player.status === 'readyToPlay') void probe();
  return () => {
    stopped = true;
    loaded.remove();
    ready.remove();
  };
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

function useWebPoster(frame: React.RefObject<View | null>, posterUrl: string | undefined): void {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const video = webVideoOf(frame.current);
    if (video) video.poster = posterUrl ?? '';
  }, [frame, posterUrl]);
}

function usePosterVisible(player: ReturnType<typeof useVideoPlayer>, posterUrl: string | undefined): boolean {
  const [showPoster, setShowPoster] = useState(posterUrl !== undefined);
  useEffect(() => {
    const sub = player.addListener('playingChange', ({ isPlaying }) => {
      if (isPlaying) setShowPoster(false);
    });
    return () => {
      sub.remove();
    };
  }, [player]);
  return Platform.OS !== 'web' && posterUrl !== undefined && showPoster;
}

export function Video(props: VideoProps): React.ReactElement {
  const {
    url,
    posterUrl,
    controls = true,
    background = '#000000',
    aspectRatio = 16 / 9,
    fit = 'contain',
    onVideoSize,
    weight,
    accessibility,
  } = props;
  const player = useVideoPlayer({ uri: url });
  const frame = useRef<View>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const showPoster = usePosterVisible(player, posterUrl);
  useWebPoster(frame, posterUrl);
  useVideoSize(player, frame, onVideoSize);

  return (
    <View
      ref={frame}
      {...accessibilityProps(accessibility)}
      style={{ width: '100%', borderRadius: BLOCK_RADIUS_DEFAULT, overflow: 'hidden', backgroundColor: background, ...weightStyle(weight) }}
    >
      <VideoView
        player={player}
        style={{ width: '100%', aspectRatio }}
        nativeControls={controls}
        contentFit={fullscreen ? 'contain' : fit}
        fullscreenOptions={{ enable: true }}
        onFullscreenEnter={() => {
          setFullscreen(true);
        }}
        onFullscreenExit={() => {
          setFullscreen(false);
        }}
        playsInline
      />
      {showPoster ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: background }}>
          <Image source={{ uri: posterUrl }} resizeMode={fit} style={{ width: '100%', height: '100%' }} />
        </View>
      ) : null}
    </View>
  );
}
