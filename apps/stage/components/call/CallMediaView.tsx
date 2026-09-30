interface CallMediaViewProps {
  stream: MediaStream | null;
  kind: 'video' | 'audio';
  mirrored?: boolean;
  contain?: boolean;
}

export const CallMediaView: (props: CallMediaViewProps) => React.ReactElement | null = () => null;
