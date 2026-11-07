import { Linking } from 'react-native';
import { capabilities } from './capabilities';
import { reported } from './errorPolicy';
import { downloadFile } from './fileDownload';
import { nativeFileName } from '@stage-labs/client/files';
import { fileOpenAction, type OpenableFile } from './fileOpen.model';
import type { DesktopBridgeGlobal, StageDesktopBridge } from './desktopBridge';

const openedUrls = new Map<string, string>();

function openInTab(url: string): void {
  if (url.startsWith('blob:')) void Linking.openURL(url).catch(reported('link.open'));
  else capabilities.openUrl(url);
}

type DesktopOpen = StageDesktopBridge['openFile'];

function desktopOpen(): DesktopOpen | undefined {
  const open = (globalThis as DesktopBridgeGlobal).stageDesktop?.openFile;
  return typeof open === 'function' ? open : undefined;
}

async function openOnDesktop(open: DesktopOpen, file: OpenableFile): Promise<void> {
  const name = nativeFileName(file.name, file.mime);
  const res = await fetch(file.url);
  if (await open(name, new Uint8Array(await res.arrayBuffer()))) return;
  await downloadFile(file.url, file.name, file.mime);
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
  openInTab(url);
}

export function openFile(file: OpenableFile): void {
  const desktop = desktopOpen();
  if (desktop !== undefined) {
    void openOnDesktop(desktop, file).catch(reported('file.open'));
    return;
  }
  const cached = openedUrls.get(file.url);
  if (cached !== undefined) {
    openInTab(cached);
    return;
  }
  const action = fileOpenAction(file);
  if (action.kind === 'download') {
    void downloadFile(file.url, file.name, file.mime).catch(reported('file.download'));
    return;
  }
  if (action.kind === 'openBlob') {
    void openInertCopy(action.url, action.mime).catch(reported('file.open'));
    return;
  }
  openInTab(action.kind === 'open' ? action.url : blobUrlFor(file.url, action.bytes, action.mime));
}
