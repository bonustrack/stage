import { Directory, Paths } from 'expo-file-system';
import { report } from './errorPolicy';

const DIR_NAME = 'stage';
const LEGACY_DIR_NAME = 'metro';

let migrated = false;

function adoptLegacyDir(): void {
  if (migrated) return;
  migrated = true;
  const legacy = new Directory(Paths.document, LEGACY_DIR_NAME);
  const current = new Directory(Paths.document, DIR_NAME);
  if (!legacy.exists || current.exists) return;
  try {
    legacy.rename(DIR_NAME);
  } catch (err) {
    report('appDocuments.migrate', err);
  }
}

export function appDocumentsDir(): Directory {
  adoptLegacyDir();
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}
