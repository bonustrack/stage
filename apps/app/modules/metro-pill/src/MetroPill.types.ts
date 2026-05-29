/** Event payload fired when the floating pill finishes a recording. */
export type RecordedEvent = {
  /** `file://…` uri of the recorded clip on disk. */
  uri: string;
  /** Recording length in milliseconds. */
  durationMs: number;
  /** Always `audio/m4a` (AAC in MPEG-4) — matches the composer's format. */
  mimeType: string;
};

export type PillErrorEvent = {
  /** Machine-readable reason, e.g. `overlay-permission-missing`,
   *  `record-start-failed: …`, `bubbles-unsupported`. */
  message: string;
};

/** The set of events the native module emits. */
export type MetroPillModuleEvents = {
  onRecorded: (e: RecordedEvent) => void;
  onPillTapped: () => void;
  /** Fired when the user taps the "open chat" glyph in the pill's expanded bar.
   *  The native side already brought the app to the foreground; JS routes to the
   *  daemon ("Tony") DM. */
  onOpenChat: () => void;
  onError: (e: PillErrorEvent) => void;
};
