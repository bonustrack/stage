import { useEffect, useState } from 'react';

const COPIED_MS = 1500;

export function useCopiedFlag(): [copied: boolean, markCopied: () => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => { setCopied(false); }, COPIED_MS);
    return () => { clearTimeout(timer); };
  }, [copied]);
  return [copied, () => { setCopied(true); }];
}
