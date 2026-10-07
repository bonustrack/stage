export interface SpeechAvailability {
  available: boolean;
  locale: string;
  download: boolean;
  reason?: string;
}

export interface SpeechEvent {
  sessionId: string;
  state?: 'listening' | 'finishing' | 'ended';
  text?: string;
  error?: string;
}

export interface SpeechBridge {
  availability(): Promise<SpeechAvailability>;
  requestPermission(): Promise<boolean>;
  downloadModel(): Promise<void>;
  start(sessionId: string): Promise<void>;
  stop(sessionId: string): Promise<void>;
  cancel(sessionId: string): Promise<void>;
  subscribe(listener: (event: SpeechEvent) => void): () => void;
}
