import { capabilities } from './capabilities';
import type { OpenableFile } from './fileOpen.model';

export function openFile(file: OpenableFile): void {
  capabilities.openUrl(file.url);
}
