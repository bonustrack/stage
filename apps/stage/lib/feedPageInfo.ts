const receivedFullPageByLine = new Map<string, boolean>();

export function setReceivedFullPage(line: string, full: boolean): void {
  receivedFullPageByLine.set(line, full);
}

export function didReceiveFullPage(line: string): boolean {
  return receivedFullPageByLine.get(line) ?? true;
}
