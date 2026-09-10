import { useEffect, useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from '../layout';

export interface QrScannerProps {
  onScan: (text: string) => void;
  dark: boolean;
}

export const SCANNER_HEIGHT = 260;

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

export function QrScanner({ onScan, dark }: QrScannerProps): React.ReactElement {
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
