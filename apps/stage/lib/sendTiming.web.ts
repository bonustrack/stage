import { subscribeAccountEpoch } from './accountEpoch';
import { subscribeAccountSelection } from './accountSelection';
import { type SendTiming } from '@stage-labs/client/xmtp/sendTiming';
import { makeSendTimingDiagnostic } from './sendTiming.core';

const diagnostic = makeSendTimingDiagnostic();
subscribeAccountEpoch(diagnostic.stop);
subscribeAccountSelection(diagnostic.stop);

if (typeof window !== 'undefined') {
  Object.assign(window, { stageSendTiming: Object.freeze({
    start: diagnostic.start, stop: diagnostic.stop, clear: diagnostic.clear, read: diagnostic.read,
  }) });
  window.addEventListener('pagehide', diagnostic.stop);
}

export function beginSendTiming(): SendTiming | undefined {
  return diagnostic.begin();
}
