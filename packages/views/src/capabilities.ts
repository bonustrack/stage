export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export interface Capabilities {
  navigate(to: string): void;
  back(): void;
  copyToClipboard(text: string): void | Promise<void>;
  toast(message: string): void;
  confirm(options: ConfirmOptions): Promise<boolean>;
  openUrl(url: string): void;
  share(payload: { text?: string; url?: string }): void | Promise<void>;
}
