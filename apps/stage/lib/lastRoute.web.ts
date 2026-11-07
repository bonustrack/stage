interface RestoreGate {
  ready: boolean;
}

const OPEN: RestoreGate = { ready: true };

export function useRestoreGate(): RestoreGate {
  return OPEN;
}
