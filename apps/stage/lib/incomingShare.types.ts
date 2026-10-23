export interface SharedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export type IncomingShare = { id: string } & (
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; files: SharedFile[] }
);

export interface IncomingShareBridge {
  getPending: () => Promise<unknown>;
  dismiss: (id: string, keepFiles: boolean) => Promise<void>;
  subscribe: (listener: () => void) => () => void;
}
