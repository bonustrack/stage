/** About panel for the System screen — app version, git commit hash, package
 *  name + build profile. Version comes from expo Constants (app.config version);
 *  the git hash is injected at build time into `extra.gitHash` (EAS sets
 *  EAS_BUILD_GIT_COMMIT_HASH on cloud builds) and shows 'dev' on un-stamped
 *  bundles. */

import Constants from 'expo-constants';
import { Box } from '../layout';
import { Title } from '@metro-labs/kit/title';
import { Text } from '@metro-labs/kit/text';

interface AboutRowProps { label: string; value: string; mono?: boolean; dark: boolean; border: string }

function AboutRow({ label, value, mono, dark, border }: AboutRowProps): React.ReactElement {
  return (
    <Box style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: border, gap: 16,
    }}>
      <Text dark={dark} variant="secondary" weight="medium" size="md">{label}</Text>
      <Text dark={dark} variant={mono ? 'mono' : 'body'} weight="semibold" size="md" numberOfLines={1}>
        {value}
      </Text>
    </Box>
  );
}

export function AboutPanel({ dark, head, sub, border }: {
  dark: boolean; head: string; sub: string; border: string;
}): React.ReactElement {
  const cfg = Constants.expoConfig;
  const version = cfg?.version ?? 'unknown';
  const extra = (cfg?.extra ?? {}) as { gitHash?: unknown; buildProfile?: unknown };
  const gitHash = typeof extra.gitHash === 'string' && extra.gitHash.length > 0 ? extra.gitHash : 'dev';
  const shortHash = gitHash === 'dev' ? 'dev' : gitHash.slice(0, 12);
  const buildProfile = typeof extra.buildProfile === 'string' && extra.buildProfile.length > 0
    ? extra.buildProfile : 'dev';
  const pkgName = cfg?.name ?? 'Metro';

  return (
    <Box style={{ paddingHorizontal: 16, paddingTop: 18 }}>
      <Title dark={dark} level={2} color={head}>About</Title>
      <Text dark={dark} variant="secondary" weight="medium" size="sm" style={{ marginTop: 4, marginBottom: 8 }}>
        Build + runtime metadata for this install.
      </Text>
      <AboutRow label="App" value={pkgName} dark={dark} border={border} />
      <AboutRow label="Version" value={version} dark={dark} border={border} />
      <AboutRow label="Commit" value={shortHash} mono dark={dark} border={border} />
      <AboutRow label="Build profile" value={buildProfile} dark={dark} border={border} />
      <Text dark={dark} color={sub} variant="caption" weight="medium" style={{ marginTop: 14 }}>
        Commit shows “dev” until a build sets EAS_BUILD_GIT_COMMIT_HASH.
      </Text>
    </Box>
  );
}
