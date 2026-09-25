import { PermissionPolicy, type PermissionPolicySet } from '@xmtp/browser-sdk';
import type { GroupMetaPolicy, GroupPolicyOption } from '@stage-labs/client/xmtp/groups';

const POLICY_OPTION: Partial<Record<PermissionPolicy, GroupPolicyOption>> = {
  [PermissionPolicy.Allow]: 'allow',
  [PermissionPolicy.Deny]: 'deny',
  [PermissionPolicy.Admin]: 'admin',
  [PermissionPolicy.SuperAdmin]: 'superAdmin',
  [PermissionPolicy.DoesNotExist]: 'admin',
};

function policyOption(policy: PermissionPolicy): GroupPolicyOption {
  return POLICY_OPTION[policy] ?? 'unknown';
}

export function webGroupMetaPolicy(set: PermissionPolicySet): GroupMetaPolicy {
  return {
    name: policyOption(set.updateGroupNamePolicy),
    description: policyOption(set.updateGroupDescriptionPolicy),
    image: policyOption(set.updateGroupImageUrlSquarePolicy),
  };
}
