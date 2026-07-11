
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  const text = options.message ? `${options.title}\n\n${options.message}` : options.title;
  return Promise.resolve(window.confirm(text));
}
