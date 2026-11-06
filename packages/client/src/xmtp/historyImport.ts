export function isImportReplay(sentNs: number, importedUntilNs: number): boolean {
  return importedUntilNs > 0 && sentNs > 0 && sentNs <= importedUntilNs;
}
