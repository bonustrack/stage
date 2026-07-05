
import { useEffect } from 'react';
import {
  consumeLabelFilterRequest,
  subscribeLabelFilterRequest,
  clearPendingLabelFilter,
} from '../../lib/labelFilterRequest';
import { UNLABELED } from './HomeScreen.filter.types';
import type { LabelFilterValue } from './HomeScreen.filter.types';

function asLabel(value: LabelFilterValue): string | null {
  return value != null && value !== UNLABELED ? value : null;
}

export function useIncomingLabelFilter(toggleLabel: (label: string) => void): void {
  useEffect(() => {
    const pending = asLabel(consumeLabelFilterRequest()?.value ?? null);
    if (pending) toggleLabel(pending);
    return subscribeLabelFilterRequest(req => {
      const label = asLabel(req.value);
      if (label) toggleLabel(label);
      clearPendingLabelFilter();
    });
  }, []);
}
