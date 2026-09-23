interface ImportMetaRegistry {
  url: string | null;
}
interface GlobalWithImportMetaRegistry {
  __ExpoImportMetaRegistry?: ImportMetaRegistry;
}

function repairExpoImportMetaUrlForWeb(): void {
  if (typeof document === 'undefined' || typeof location === 'undefined') return;
  const siteRootAsImportMetaBase = { url: `${location.origin}/` };
  (globalThis as GlobalWithImportMetaRegistry).__ExpoImportMetaRegistry = siteRootAsImportMetaBase;
}

repairExpoImportMetaUrlForWeb();

export {};
