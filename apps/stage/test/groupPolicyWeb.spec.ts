import { describe, expect, test } from 'bun:test';
import { PermissionPolicy, type PermissionPolicySet } from '@xmtp/browser-sdk';
import { webGroupMetaPolicy } from '../lib/groupPolicyWeb.model';

function policySet(overrides: Partial<PermissionPolicySet>): PermissionPolicySet {
  return {
    addMemberPolicy: PermissionPolicy.Allow,
    removeMemberPolicy: PermissionPolicy.Admin,
    addAdminPolicy: PermissionPolicy.SuperAdmin,
    removeAdminPolicy: PermissionPolicy.SuperAdmin,
    updateGroupNamePolicy: PermissionPolicy.Allow,
    updateGroupDescriptionPolicy: PermissionPolicy.Allow,
    updateGroupImageUrlSquarePolicy: PermissionPolicy.Allow,
    updateMessageDisappearingPolicy: PermissionPolicy.Admin,
    updateAppDataPolicy: PermissionPolicy.Allow,
    ...overrides,
  };
}

describe('web group policy', () => {
  test('reads name, description and image from their own policies', () => {
    expect(webGroupMetaPolicy(policySet({
      updateGroupNamePolicy: PermissionPolicy.Admin,
      updateGroupDescriptionPolicy: PermissionPolicy.Deny,
      updateGroupImageUrlSquarePolicy: PermissionPolicy.SuperAdmin,
    }))).toEqual({ name: 'admin', description: 'deny', image: 'superAdmin' });
    expect(webGroupMetaPolicy(policySet({}))).toEqual({ name: 'allow', description: 'allow', image: 'allow' });
  });

  test('a missing policy is admin-only and a compound one is unknown', () => {
    expect(webGroupMetaPolicy(policySet({
      updateGroupNamePolicy: PermissionPolicy.DoesNotExist,
      updateGroupDescriptionPolicy: PermissionPolicy.Other,
    }))).toEqual({ name: 'admin', description: 'unknown', image: 'allow' });
  });
});
