export type DateTimeMode = 'date' | 'time' | 'datetime';

export interface WallClock {
  date: Date | null;
  hour: number;
  minute: number;
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ZONE = '(?:Z|[+-]\\d{2}:?\\d{2})?';
const DATE_TIME = new RegExp(`^(\\d{4})-(\\d{2})-(\\d{2})(?:[T ](\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.\\d+)?)?${ZONE})?$`, 'i');
const TIME_ONLY = new RegExp(`^(\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.\\d+)?)?${ZONE}$`, 'i');

export function dateTimeMode(enableDate: boolean | undefined, enableTime: boolean | undefined): DateTimeMode {
  if (enableTime === true && enableDate === true) return 'datetime';
  if (enableTime === true) return 'time';
  return 'date';
}

function validDate(year: number, month: number, day: number): Date | null {
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

function clockParts(h: string | undefined, m: string | undefined, s: string | undefined): { hour: number; minute: number } | null {
  const hour = Number(h ?? 0);
  const minute = Number(m ?? 0);
  return hour <= 23 && minute <= 59 && Number(s ?? 0) <= 59 ? { hour, minute } : null;
}

export function parseWallClock(value: string | undefined): WallClock | null {
  if (value === undefined || value === '') return null;
  const time = TIME_ONLY.exec(value);
  if (time !== null) {
    const clock = clockParts(time[1], time[2], time[3]);
    return clock === null ? null : { date: null, ...clock };
  }
  const full = DATE_TIME.exec(value);
  if (full === null) return null;
  const date = validDate(Number(full[1]), Number(full[2]), Number(full[3]));
  const clock = clockParts(full[4], full[5], full[6]);
  return date === null || clock === null ? null : { date, ...clock };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatWallClock(mode: DateTimeMode, date: Date | null, hour: number, minute: number): string {
  const time = `${pad(hour)}:${pad(minute)}:00`;
  if (mode === 'time') return time;
  const day = toISODate(date ?? new Date());
  return mode === 'date' ? day : `${day}T${time}`;
}

function dateLabel(d: Date): string {
  return `${MONTHS[d.getMonth()] ?? ''} ${d.getDate()}, ${d.getFullYear()}`;
}

export function wallClockLabel(mode: DateTimeMode, clock: WallClock | null): string | undefined {
  if (clock === null) return undefined;
  const time = `${pad(clock.hour)}:${pad(clock.minute)}`;
  if (mode === 'time') return time;
  if (clock.date === null) return undefined;
  return mode === 'date' ? dateLabel(clock.date) : `${dateLabel(clock.date)}, ${time}`;
}

export function dayInRange(d: Date, min: string | undefined, max: string | undefined): boolean {
  const minDate = parseWallClock(min)?.date ?? null;
  const maxDate = parseWallClock(max)?.date ?? null;
  if (minDate !== null && d < minDate) return false;
  return !(maxDate !== null && d > maxDate);
}

export function wrapClock(value: number, delta: number, size: number): number {
  return (((value + delta) % size) + size) % size;
}

export function buildCells(year: number, month: number): (Date | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  return cells;
}
