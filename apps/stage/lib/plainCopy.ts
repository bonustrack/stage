import { plainCopyText } from './plainCopy.model';

function editableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}

function copyPlainText(event: ClipboardEvent): void {
  const text = plainCopyText(editableTarget(event.target), window.getSelection()?.toString() ?? '');
  if (text === null || !event.clipboardData) return;
  event.preventDefault();
  event.clipboardData.setData('text/plain', text);
}

export function installPlainTextCopy(): void {
  if (typeof document === 'undefined') return;
  document.addEventListener('copy', copyPlainText);
}
