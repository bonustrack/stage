
import { useEffect, useState } from 'react';
import { decodeCall, type DecodedCall } from '@stage-labs/client/wallet/txDecode';

export function useDecodedCall(
  to: string | undefined, data: string | undefined, chainId: number,
): { call: DecodedCall | null; pending: boolean } {
  const hasData = !!data && data !== '0x' && data.length > 2;
  const [call, setCall] = useState<DecodedCall | null>(null);
  const [pending, setPending] = useState(hasData);
  useEffect(() => {
    if (!hasData) { setCall(null); setPending(false); return; }
    let alive = true;
    setPending(true);
    void decodeCall(to, data, chainId).then(r => {
      if (alive) { setCall(r); setPending(false); }
    });
    return () => { alive = false; };
  }, [to, data, chainId, hasData]);
  return { call, pending };
}
