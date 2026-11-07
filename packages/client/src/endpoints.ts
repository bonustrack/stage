export const STAGE_HOST = 'stage.box';
export const STAGE_ORIGIN = `https://${STAGE_HOST}`;
export const PROXY_ORIGIN = 'https://proxy.stage.box';
export const PUSH_ORIGIN = 'https://push.stage.box';
export const BUNDLER_HOST = 'bundler.stage.box';
export const BUNDLER_ORIGIN = `https://${BUNDLER_HOST}`;
export const PREVIEW_LAUNCHER_PATH = '/preview-launcher.html';
export const APP_SCHEME = 'stage';
export const EAS_PROJECT_ID = '1707f2db-c2b8-4c91-9341-27b1d57d355f';
export const EAS_UPDATES_URL = `https://u.expo.dev/${EAS_PROJECT_ID}`;
export const MAIN_BRANCH = 'main';

export const PROXY_ROUTES = {
  health: '/health',
  preview: '/preview',
  img: '/img',
  settle: '/x402-settle',
  attachments: '/attachments',
  nodes: '/nodes',
  history: '/xmtp-history/',
  push: '/xmtp-push/',
  names: '/names/',
  mail: '/mail/',
} as const;

export const UPLOAD_MAX_BYTES = 100_000_000;

export const STAGE_CLIENT_HEADER = 'x-stage-client';
const STAGE_CLIENT_VALUE = '1';
export const STAGE_CLIENT_HEADERS: Readonly<Record<string, string>> = { [STAGE_CLIENT_HEADER]: STAGE_CLIENT_VALUE };

export const HISTORY_ENVS = ['production', 'dev'] as const;
export type HistoryEnv = (typeof HISTORY_ENVS)[number];

export type NamesOp = 'status' | 'check' | 'resolve' | 'claim';
export type MailOp = 'key' | 'challenge' | 'session' | 'list' | 'message' | 'box';

export function isStageClient(headers: { get(name: string): string | null }): boolean {
  return headers.get(STAGE_CLIENT_HEADER) === STAGE_CLIENT_VALUE;
}

export function historyEnvOf(xmtpEnv: string): HistoryEnv {
  return xmtpEnv === 'dev' ? 'dev' : 'production';
}

export function namesPath(op: NamesOp): string {
  return `${PROXY_ROUTES.names}${op}`;
}

export function mailPath(op: MailOp): string {
  return `${PROXY_ROUTES.mail}${op}`;
}

const LITERAL_CHANNEL_CHARACTER = /^[A-Za-z0-9.-]$/;

export function channelKey(branch: string): string {
  return Array.from(new TextEncoder().encode(branch), (byte) => {
    const character = String.fromCharCode(byte);
    return LITERAL_CHANNEL_CHARACTER.test(character) ? character : `_${byte.toString(16).padStart(2, '0')}`;
  }).join('');
}

export interface ManifestQuery {
  branch: string;
  runtime: string;
  platform: string;
}

export function easManifestUrl({ branch, runtime, platform }: ManifestQuery): string {
  const target = new URL(EAS_UPDATES_URL);
  target.searchParams.set('channel-name', channelKey(branch));
  target.searchParams.set('runtime-version', runtime);
  target.searchParams.set('platform', platform);
  return target.toString();
}

export function previewLauncherUrl(target: string): string {
  return `${BUNDLER_ORIGIN}${PREVIEW_LAUNCHER_PATH}?u=${encodeURIComponent(target)}`;
}
