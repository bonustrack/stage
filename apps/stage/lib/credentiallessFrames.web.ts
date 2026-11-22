type CredentiallessFrame = HTMLIFrameElement & { credentialless?: boolean };

let installed = false;

export function installCredentiallessFrames(): void {
  if (installed || !window.crossOriginIsolated || !('credentialless' in HTMLIFrameElement.prototype)) return;
  installed = true;
  const create = document.createElement.bind(document);
  document.createElement = (tagName: string, options?: ElementCreationOptions): HTMLElement => {
    const element = create(tagName, options);
    if (element instanceof HTMLIFrameElement) (element as CredentiallessFrame).credentialless = true;
    return element;
  };
}
