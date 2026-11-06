import { useEffect } from 'react';
import { makeValue } from '../../../lib/storeCore';

const boardQuery = makeValue('');

export function useBoardQuery(): [string, (query: string) => void] {
  useEffect(
    () => () => {
      boardQuery.set('');
    },
    [],
  );
  return [boardQuery.use(), boardQuery.set];
}
