import type { TabsNode, TabsOption } from '@stage-labs/kit/kit';
import view from './walletTabs.json';
import { buildView } from '../buildView';
import { WALLET_TAB_CHANGE } from '../actions';

export interface WalletTabsParams {
  value: string;
  options: TabsOption[];
  changeType?: string;
}

export function walletTabs(params: WalletTabsParams): TabsNode {
  return (buildView(view, {
    value: params.value,
    options: params.options,
    changeType: params.changeType ?? WALLET_TAB_CHANGE,
  }) as TabsNode);
}
