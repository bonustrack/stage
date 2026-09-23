import Constants from 'expo-constants';

export const STAGE_GITHUB_URL = 'https://github.com/bonustrack/stage';

export function commitUrl(gitHash: string): string | undefined {
  return gitHash === 'dev' || gitHash.length === 0 ? undefined : `${STAGE_GITHUB_URL}/commit/${gitHash}`;
}

interface BuildMeta {
  gitHash: string; commitTime: string; buildProfile: string;
}

function extraString(extra: Record<string, unknown>, key: string, fallback: string): string {
  const v = extra[key];
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

export function buildMeta(): BuildMeta {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  return {
    gitHash: extraString(extra, 'gitHash', 'dev'),
    commitTime: extraString(extra, 'commitTime', ''),
    buildProfile: extraString(extra, 'buildProfile', 'dev'),
  };
}
