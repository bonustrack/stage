import { z } from 'zod';
import { parseOrThrow } from '../validate';

export interface ReleaseAsset {
  name: string;
  url: string;
}

export interface Release {
  tag: string;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

const releaseSchema = z.array(z.object({
  tag_name: z.string(),
  prerelease: z.boolean(),
  draft: z.boolean(),
  assets: z.array(z.object({ name: z.string(), browser_download_url: z.string() })),
}));

export async function fetchReleases(owner: string, repo: string, limit = 20): Promise<Release[]> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=${limit}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`github releases ${res.status}`);
  const rows = parseOrThrow('github.releases', releaseSchema, await res.json());
  return rows
    .filter((row) => !row.draft)
    .map((row) => ({
      tag: row.tag_name,
      prerelease: row.prerelease,
      assets: row.assets.map((asset) => ({ name: asset.name, url: asset.browser_download_url })),
    }));
}
