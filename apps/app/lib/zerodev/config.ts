
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { ENTRY_POINT_VERSION } from '@stage-labs/client/zerodev/config';

export { SCW_CHAIN_ID } from '@stage-labs/client/zerodev/config';

export const ENTRY_POINT = getEntryPoint(ENTRY_POINT_VERSION);

export const KERNEL_VERSION = KERNEL_V3_1;
