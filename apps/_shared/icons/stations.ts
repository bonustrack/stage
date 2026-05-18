/** Shared station icon definitions: brand color + minimal SVG path. */
/** Imported by apps/app (RN) and apps/ui (Vue) — keep dependency-free. */

export type StationKey = 'discord' | 'telegram' | 'webhook' | 'claude' | 'codex';

export interface StationIconDef {
  key: StationKey | 'generic';
  /** Display label shown next to the icon. */
  label: string;
  /** Background fill colour (brand hue). */
  color: string;
  /** Foreground (glyph) colour. Always close to white for AA contrast on brand fills. */
  fg: string;
  /** SVG inner markup (<path>, <circle>, …) rendered inside a 24×24 viewBox. */
  svg: string;
}

const DISCORD_PATH = 'M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.075.075 0 0 0-.079.037c-.21.375-.444.864-.608 '
  + '1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 '
  + '4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 '
  + '3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892'
  + '.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 '
  + '0 0 1 .078.01c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107'
  + 'c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .031-.056c.5-5.177-'
  + '.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 '
  + '2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 '
  + '0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z';

const TELEGRAM_PATH = 'M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2'
  + '-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z';

const WEBHOOK_PATH = 'M10.46 19c-.79 1.76-2.55 3-4.6 3a5 5 0 0 1 0-10c.36 0 .71.04 1.05.11l-1.04 2.04A2.99 '
  + '2.99 0 0 0 8.86 19h1.6Zm1.54-5.46l3.21 5.99a5 5 0 1 0 4.79-7.5l-.99 2.04a2.99 2.99 0 1 1-2.59 4.55l-3.21'
  + '-5.99-1.21.91Zm-3.93-3.78a5 5 0 1 1 9.39 2.39l-1.04 2.04A2.99 2.99 0 1 0 10.94 11l-3.21 5.99-1.66-2Z';

const CLAUDE_PATH = 'M4.5 15l4-12h2.5l-3 9h4l1-3h2.5l1 3h4l-3-9H20l4 12H4.5z';

const CODEX_PATH = 'M12 2 4 6v8l8 4 8-4V6l-8-4zm0 2.2L18 7v6l-6 3-6-3V7l6-2.8zM8 9v4l4 2 4-2V9l-4-2-4 2z';

export const STATIONS: Record<StationKey, StationIconDef> = {
  discord: {
    key: 'discord', label: 'Discord', color: '#5865F2', fg: '#ffffff',
    svg: `<path fill="currentColor" d="${DISCORD_PATH}"/>`,
  },
  telegram: {
    key: 'telegram', label: 'Telegram', color: '#26A5E4', fg: '#ffffff',
    svg: `<path fill="currentColor" d="${TELEGRAM_PATH}"/>`,
  },
  webhook: {
    key: 'webhook', label: 'Webhook', color: '#6b7280', fg: '#ffffff',
    svg: `<path fill="currentColor" d="${WEBHOOK_PATH}"/>`,
  },
  claude: {
    key: 'claude', label: 'Claude', color: '#cc785c', fg: '#ffffff',
    svg: `<path fill="currentColor" d="${CLAUDE_PATH}"/>`,
  },
  codex: {
    key: 'codex', label: 'Codex', color: '#10a37f', fg: '#ffffff',
    svg: `<path fill="currentColor" d="${CODEX_PATH}"/>`,
  },
};

export const GENERIC_STATION: StationIconDef = {
  key: 'generic', label: 'Station', color: '#a3b8d8', fg: '#0f1115',
  svg: '<circle cx="12" cy="12" r="6" fill="currentColor"/>',
};

export function getStationIcon(station: string): StationIconDef {
  return STATIONS[station as StationKey] ?? GENERIC_STATION;
}

export function stationLabel(station: string): string {
  return STATIONS[station as StationKey]?.label ?? station;
}
