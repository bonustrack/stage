import { useEffect, useRef, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from '../layout';

export interface QrScannerProps {
  onScan: (text: string) => void;
  dark: boolean;
}

export const SCANNER_HEIGHT = 260;

type CameraModule = typeof import('expo-camera');

const UNAVAILABLE_MESSAGE =
  'Scanning needs a newer build of the app. Update the app, or paste the code below.';

interface CameraLoad { mod: CameraModule | null; failed: boolean }

function useCameraModule(): CameraLoad {
  const [state, setState] = useState<CameraLoad>({ mod: null, failed: false });
  useEffect(() => {
    let alive = true;
    import('expo-camera')
      .then((mod) => { if (alive) setState({ mod, failed: false }); })
      .catch(() => { if (alive) setState({ mod: null, failed: true }); });
    return () => { alive = false; };
  }, []);
  return state;
}

function Notice({ message }: { message: string }): React.ReactElement {
  return (
    <Col align="center" padding={{ y: 16 }}>
      <Text size="sm" role="secondary" textAlign="center">{message}</Text>
    </Col>
  );
}

function PermissionPrompt({ dark, onAllow }: { dark: boolean; onAllow: () => void }): React.ReactElement {
  return (
    <Col gap={10} align="center" padding={{ y: 16 }}>
      <Text size="sm" role="secondary" textAlign="center">
        Camera access is needed to scan the code from your other device.
      </Text>
      <Button dark={dark} variant="soft" color="primary" label="Allow camera" onPress={onAllow} />
    </Col>
  );
}

function LiveScanner({ mod, onScan, dark }: QrScannerProps & { mod: CameraModule }): React.ReactElement {
  const { CameraView, useCameraPermissions } = mod;
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  if (!permission) return <Col height={SCANNER_HEIGHT} />;
  if (!permission.granted) {
    return <PermissionPrompt dark={dark} onAllow={() => { void requestPermission(); }} />;
  }
  return (
    <Col height={SCANNER_HEIGHT} style={{ overflow: 'hidden', borderRadius: 12 }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current || data.length === 0) return;
          handled.current = true;
          onScan(data);
        }}
      />
    </Col>
  );
}

export function QrScanner({ onScan, dark }: QrScannerProps): React.ReactElement {
  const { mod, failed } = useCameraModule();
  if (failed) return <Notice message={UNAVAILABLE_MESSAGE} />;
  if (mod === null) return <Col height={SCANNER_HEIGHT} />;
  return <LiveScanner mod={mod} onScan={onScan} dark={dark} />;
}
