/** A tappable row that opens the @metro-labs/kit package on GitHub. Lives at
 *  the top of the Kit page so the design-system source is one tap away. */

import { GitHubLinkRow } from './GitHubLinkRow';

const KIT_GITHUB_URL = 'https://github.com/bonustrack/metro/tree/main/packages/kit';

export function KitGitHubLink({ dark, head, sub, border, rowBg }: {
  dark: boolean; head: string; sub: string; border: string; rowBg: string;
}): React.ReactElement {
  return (
    <GitHubLinkRow
      dark={dark} head={head} sub={sub} border={border} rowBg={rowBg}
      url={KIT_GITHUB_URL}
      title="View @metro-labs/kit on GitHub"
      subtitle="bonustrack/metro · packages/kit"
    />
  );
}
