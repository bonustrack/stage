import { capabilities } from './capabilities';
import { reported } from './errorPolicy';
import { downloadFile } from './fileDownload';
import { fileOpenAction, type OpenableFile } from './fileOpen.model';

const openedUrls = new Map<string, string>();

type DesktopOpen = (name: string, bytes: Uint8Array) => Promise<void>;

function desktopOpen(): DesktopOpen | undefined {
  const bridge = (globalThis as { stageDesktop?: { openFile?: unknown } }).stageDesktop;
  return typeof bridge?.openFile === 'function' ? bridge.openFile as DesktopOpen : undefined;
}

async function openOnDesktop(open: DesktopOpen, file: OpenableFile): Promise<void> {
  const res = await fetch(file.url);
  await open(file.name, new Uint8Array(await res.arrayBuffer()));
}

function blobUrlFor(dataUrl: string, bytes: Uint8Array, mime: string): string {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mime }));
  openedUrls.set(dataUrl, url);
  return url;
}

async function openInertCopy(source: string, mime: string): Promise<void> {
  const blob = await (await fetch(source)).blob();
  const url = URL.createObjectURL(new Blob([blob], { type: mime }));
  openedUrls.set(source, url);
  capabilities.openUrl(url);
}

export function openFile(file: OpenableFile): void {
  const desktop = desktopOpen();
  if (desktop !== undefined) {
    void openOnDesktop(desktop, file).catch(reported('file.open'));
    return;
  }
  const cached = openedUrls.get(file.url);
  if (cached !== undefined) {
    capabilities.openUrl(cached);
    return;
  }
  const action = fileOpenAction(file);
  if (action.kind === 'download') {
    void downloadFile(file.url, file.name).catch(reported('file.download'));
    return;
  }
  if (action.kind === 'openBlob') {
    void openInertCopy(action.url, action.mime).catch(reported('file.open'));
    return;
  }
  capabilities.openUrl(action.kind === 'open' ? action.url : blobUrlFor(file.url, action.bytes, action.mime));
}
