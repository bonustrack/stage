import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function signedIdentifier(appPath) {
  try {
    const out = execFileSync('codesign', ['-dv', appPath], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    return /Identifier=(\S+)/.exec(out)?.[1] ?? '';
  } catch {
    return '';
  }
}

export default async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const identifier = signedIdentifier(appPath);
  if (identifier !== '' && identifier !== 'Electron') return;
  const entitlements = path.join(here, '..', 'build', 'entitlements.mac.plist');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', '--entitlements', entitlements, appPath], { stdio: 'inherit' });
}
