export interface StartupMarks {
  processStart?: number;
  bundleStart?: number;
  bundleEnd?: number;
  chatsShown?: number;
}

export interface StartupRow {
  label: string;
  value: string;
}

const MAX_PLAUSIBLE_MS = 10 * 60_000;

function span(from: number | undefined, to: number | undefined): number | null {
  if (from === undefined || to === undefined || !Number.isFinite(from) || !Number.isFinite(to)) return null;
  const ms = to - from;
  return ms >= 0 && ms <= MAX_PLAUSIBLE_MS ? Math.round(ms) : null;
}

export function startupRows(marks: StartupMarks, web: boolean): StartupRow[] {
  const origin = web ? 0 : marks.processStart;
  const rows: { label: string; ms: number | null }[] = [
    { label: 'App start to JS', ms: web ? null : span(marks.processStart, marks.bundleStart) },
    { label: 'JS bundle', ms: web ? null : span(marks.bundleStart, marks.bundleEnd) },
    { label: 'Until chat list', ms: span(origin, marks.chatsShown) },
  ];
  return rows.flatMap(({ label, ms }) => (ms === null ? [] : [{ label, value: `${ms.toLocaleString('en-US')} ms` }]));
}
