
import type { SdkMethod } from './methods';

export type RailgunDispatch = <T = unknown>(method: SdkMethod, args?: readonly unknown[]) => Promise<T>;
