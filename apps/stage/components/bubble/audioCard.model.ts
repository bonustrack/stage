import { fileSizeLabel } from './fileCard.model';

const VOICE_NOTE_NAME = /^voice([-_.]|$)/i;

export function isVoiceNote(att: { name?: string }): boolean {
  const name = att.name?.trim() ?? '';
  return name === '' || VOICE_NOTE_NAME.test(name);
}

export function clockLabel(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function base64ByteLength(b64: string): number {
  const clean = b64.replace(/\s/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

export function audioByteSize(att: { size?: number; dataB64?: string }): number | undefined {
  if (att.size !== undefined) return att.size;
  return att.dataB64 ? base64ByteLength(att.dataB64) : undefined;
}

export function seekFraction(offset: number, width: number): number {
  if (!(width > 0) || !Number.isFinite(offset)) return 0;
  return Math.max(0, Math.min(1, offset / width));
}

export interface AudioCardModel {
  title: string;
  subtitle: string;
  time: string;
  progress: number;
}

export function audioCardModel(
  att: { name?: string; size?: number; dataB64?: string },
  playback: { position: number; duration: number },
): AudioCardModel {
  const { position, duration } = playback;
  const name = att.name?.trim() ?? '';
  const title = name === '' ? 'Audio' : name;
  const length = duration > 0 ? clockLabel(duration) : '';
  const subtitle = [length, fileSizeLabel(audioByteSize(att))].filter(Boolean).join(' · ');
  const progress = duration > 0 ? seekFraction(position, duration) : 0;
  const time = length === '' ? clockLabel(position) : `${clockLabel(position)} / ${length}`;
  return { title, subtitle, time, progress };
}
