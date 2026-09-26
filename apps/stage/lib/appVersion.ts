import Constants from 'expo-constants';
import * as Application from 'expo-application';

function resolveNativeBuild(): string | null {
  if (Application.nativeBuildVersion) return Application.nativeBuildVersion;
  const code = Constants.expoConfig?.android?.versionCode;
  return code != null ? String(code) : null;
}

export function versionLabel(): string {
  const version = Constants.expoConfig?.version ?? 'unknown';
  const nativeBuild = resolveNativeBuild();
  return nativeBuild ? `${version} (build ${nativeBuild})` : version;
}
