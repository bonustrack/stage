export const STAGE_GITHUB_URL = 'https://github.com/bonustrack/stage';

export function commitUrl(gitHash: string): string | undefined {
  return gitHash === 'dev' || gitHash.length === 0 ? undefined : `${STAGE_GITHUB_URL}/commit/${gitHash}`;
}
