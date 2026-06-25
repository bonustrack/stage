import type { TabsNode, TabsOption } from '@stage-labs/kit/kit';
import { WALLET_TAB_CHANGE } from '../actions';

export interface WalletTabsParams {
  value: string;
  options: TabsOption[];
  changeType?: string;
}

export function walletTabs(params: WalletTabsParams): TabsNode {
  return {
    type: 'Tabs',
    name: 'walletTab',
    value: params.value,
    variant: 'underline',
    options: params.options,
    onChangeAction: { type: params.changeType ?? WALLET_TAB_CHANGE, payload: {} },
  };
}
