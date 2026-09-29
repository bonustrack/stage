import { createValueStore } from '../../../lib/persistedStore';
import { balanceCurrency, nextBalanceCurrency, type BalanceCurrency } from './balance.model';

const store = createValueStore<BalanceCurrency>({
  key: 'wallet.balanceCurrency',
  default: 'USD',
  deserialize: balanceCurrency,
});

export const useBalanceCurrency = (): BalanceCurrency => store.use();
export const cycleBalanceCurrency = (): void => { store.set(nextBalanceCurrency(store.get())); };
