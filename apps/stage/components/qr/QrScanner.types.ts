export interface QrScannerProps {
  onScan: (text: string) => void;
  dark: boolean;
}

export const SCANNER_HEIGHT = 260;
