import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from '../layout';
import { View } from '../layout/native';

export interface QrScannerProps {
  onScan: (text: string) => void;
  dark: boolean;
}

export const SCANNER_HEIGHT = 260;

const SCAN_INTERVAL_MS = 250;
const CAMERA_ERROR = 'Could not open the camera. Allow camera access for this site, or paste the code below.';

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

function decodeFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): string | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width === 0 || height === 0) return null;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  const code = jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' });
  return code !== null && code.data.length > 0 ? code.data : null;
}

async function detectOnce(
  video: HTMLVideoElement, canvas: HTMLCanvasElement, detector: BarcodeDetectorLike | null,
): Promise<string | null> {
  if (detector === null) return decodeFrame(video, canvas);
  const found = await detector.detect(video).catch((): DetectedBarcode[] => []);
  const first = found[0];
  return first !== undefined && first.rawValue.length > 0 ? first.rawValue : null;
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

function useCameraScan(host: HTMLElement | null, onScan: (text: string) => void): string | null {
  const [error, setError] = useState<string | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  useEffect(() => {
    if (host === null) return;
    const media = navigator.mediaDevices;
    if (typeof media?.getUserMedia !== 'function') { setError(CAMERA_ERROR); return; }
    const video = attachVideo(host);
    const canvas = document.createElement('canvas');
    const detector = nativeDetector();
    let done = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = async (): Promise<void> => {
      if (done) return;
      const text = await detectOnce(video, canvas, detector);
      if (text === null || done) return;
      done = true;
      onScanRef.current(text);
    };
    media.getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (stream) => {
        if (done) { for (const track of stream.getTracks()) track.stop(); return; }
        video.srcObject = stream;
        await video.play();
        timer = setInterval(() => { void tick(); }, SCAN_INTERVAL_MS);
      })
      .catch(() => { setError(CAMERA_ERROR); });
    return () => {
      done = true;
      if (timer !== null) clearInterval(timer);
      stopStream(video);
    };
  }, [host]);
  return error;
}

export function QrScanner({ onScan }: QrScannerProps): React.ReactElement {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const error = useCameraScan(host, onScan);
  if (error !== null) {
    return (
      <Col align="center" padding={{ y: 16 }}>
        <Text size="sm" role="secondary" textAlign="center">{error}</Text>
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
