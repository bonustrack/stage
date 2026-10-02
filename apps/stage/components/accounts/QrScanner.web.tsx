import { useEffect, useRef, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from '../layout';
import { View } from 'react-native';
import { ignored, recover } from '../../lib/errorPolicy';

export interface QrScannerProps {
  onScan: (text: string) => void;
  dark: boolean;
}

export const SCANNER_HEIGHT = 260;

const SCAN_INTERVAL_MS = 250;
const CAMERA_ERROR = 'Could not open the camera. Allow camera access for this site, or paste the code below.';
const LOAD_ERROR = 'Could not load the QR reader. Check your connection and try again, or paste the code below.';

type ScanError = typeof CAMERA_ERROR | typeof LOAD_ERROR;
type FrameReader = (video: HTMLVideoElement) => Promise<string | null>;
type Decode = typeof import('jsqr').default;

interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

function nativeDetector(): BarcodeDetectorLike | null {
  const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (ctor === undefined) return null;
  try {
    return new ctor({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

function decodeFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement, decode: Decode): string | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width === 0 || height === 0) return null;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  const code = decode(image.data, width, height, { inversionAttempts: 'dontInvert' });
  return code !== null && code.data.length > 0 ? code.data : null;
}

async function loadFrameReader(): Promise<FrameReader> {
  const detector = nativeDetector();
  if (detector !== null) {
    return async (video) => {
      const found = await detector.detect(video).catch(ignored<DetectedBarcode[]>([], 'probe'));
      const first = found[0];
      return first !== undefined && first.rawValue.length > 0 ? first.rawValue : null;
    };
  }
  const { default: decode } = await import('jsqr');
  const canvas = document.createElement('canvas');
  return (video) => Promise.resolve(decodeFrame(video, canvas, decode));
}

function attachVideo(host: HTMLElement): HTMLVideoElement {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', 'true');
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';
  host.appendChild(video);
  return video;
}

function stopStream(video: HTMLVideoElement): void {
  const stream = video.srcObject;
  if (stream instanceof MediaStream) {
    for (const track of stream.getTracks()) track.stop();
  }
  video.srcObject = null;
  video.remove();
}

function useCameraScan(
  host: HTMLElement | null, onScan: (text: string) => void,
): { error: ScanError | null; retry: () => void } {
  const [error, setError] = useState<ScanError | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  useEffect(() => {
    if (host === null) return;
    const media = navigator.mediaDevices;
    if (typeof media?.getUserMedia !== 'function') { setError(CAMERA_ERROR); return; }
    const video = attachVideo(host);
    let done = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = (read: FrameReader): void => {
      const tick = async (): Promise<void> => {
        if (done) return;
        const text = await read(video);
        if (text === null || done) return;
        done = true;
        onScanRef.current(text);
      };
      timer = setInterval(() => { void tick(); }, SCAN_INTERVAL_MS);
    };
    const reader = loadFrameReader().catch(recover<FrameReader | null>('qrScanner.load', null));
    media.getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (stream) => {
        if (done) { for (const track of stream.getTracks()) track.stop(); return; }
        video.srcObject = stream;
        await video.play();
        const read = await reader;
        if (done) return;
        if (read === null) { setError(LOAD_ERROR); return; }
        start(read);
      })
      .catch(() => { setError(CAMERA_ERROR); });
    return () => {
      done = true;
      if (timer !== null) clearInterval(timer);
      stopStream(video);
    };
  }, [host]);
  return { error, retry: () => { setError(null); } };
}

export function QrScanner({ onScan, dark }: QrScannerProps): React.ReactElement {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const { error, retry } = useCameraScan(host, onScan);
  if (error !== null) {
    return (
      <Col gap={10} align="center" padding={{ y: 16 }}>
        <Text size="3xs" role="secondary" textAlign="center">{error}</Text>
        {error === LOAD_ERROR ? (
          <Button dark={dark} variant="soft" color="primary" label="Try again" onPress={retry} style={{ alignSelf: 'center' }} />
        ) : null}
      </Col>
    );
  }
  return (
    <View
      ref={(node) => { setHost(node as unknown as HTMLElement | null); }}
      style={{ height: SCANNER_HEIGHT, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000000' }}
    />
  );
}
