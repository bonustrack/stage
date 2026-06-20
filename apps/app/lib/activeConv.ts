

let activeConvId: string | null = null;

export function setActiveConvId(convId: string | null): void {
  activeConvId = convId ? convId.toLowerCase() : null;
}

export function isActiveConv(convId: string | null | undefined): boolean {
  if (!convId || !activeConvId) return false;
  return convId.toLowerCase() === activeConvId;
}
