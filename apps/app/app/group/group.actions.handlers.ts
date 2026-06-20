
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { leaveGroupConv, shortAddress } from '../../modules/messaging';
import { flash } from '../../lib/toast';
import { uploadAvatar } from '../../lib/profile';
import {
  addGroupMember, removeGroupMember, updateGroupImage,
  updateGroupDescription, updateGroupName,
} from './group.helpers';

export interface GroupHandlersCtx {
  line: string;
  invalidateConvMeta: () => void;
  router: { replace: (href: string) => void };
  addDraft: string; adding: boolean; setAdding: (b: boolean) => void; setAddDraft: (s: string) => void;
  setMembers: (m: string[]) => void;
  removing: string | null; setRemoving: (s: string | null) => void;
  uploadingImage: boolean; setUploadingImage: (b: boolean) => void; setImageUrl: (s: string) => void;
  descriptionDraft: string; savingDescription: boolean; setSavingDescription: (b: boolean) => void;
  setDescription: (s: string) => void; setEditingDescription: (b: boolean) => void;
  draft: string; saving: boolean; setSaving: (b: boolean) => void;
  setName: (n: string | null) => void; setEditing: (b: boolean) => void;
  setLeaving: (b: boolean) => void;
}

export function makeAddMember(c: GroupHandlersCtx): (onSuccess?: () => void) => Promise<void> {
  return async (onSuccess?: () => void): Promise<void> => {
    const addr = c.addDraft.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr) || c.adding) {
      Alert.alert('Add member', 'Enter a valid 0x… Ethereum address.');
      return;
    }
    c.setAdding(true);
    try {
      const next = await addGroupMember(c.line, addr);
      c.setAddDraft('');
      onSuccess?.();
      c.setMembers(next);
      c.invalidateConvMeta();
    } catch (e) {
      Alert.alert('Add member failed', (e as Error).message ?? 'Unknown error');
    } finally { c.setAdding(false); }
  };
}

export function makeRemoveMember(c: GroupHandlersCtx): (addr: string) => void {
  return (addr: string): void => {
    Alert.alert(
      'Remove member',
      `Remove ${shortAddress(addr)} from this group? They'll lose access to past + future messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => { void runRemoveMember(c, addr); } },
      ],
    );
  };
}

async function runRemoveMember(c: GroupHandlersCtx, addr: string): Promise<void> {
  c.setRemoving(addr.toLowerCase());
  try {
    c.setMembers(await removeGroupMember(c.line, addr));
    c.invalidateConvMeta();
  } catch (e) {
    Alert.alert('Remove member failed', (e as Error).message ?? 'Unknown error');
  } finally { c.setRemoving(null); }
}

export function makePickImage(c: GroupHandlersCtx): () => Promise<void> {
  return async (): Promise<void> => {
    if (c.uploadingImage) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', quality: 0.85, allowsMultipleSelection: false,
      allowsEditing: true, aspect: [1, 1],
    });
    const a = r.canceled ? undefined : r.assets[0];
    if (a === undefined) return;
    c.setUploadingImage(true);
    try {
      const url = await uploadAvatar(a.uri, a.mimeType ?? 'image/jpeg', a.fileName ?? 'group-avatar');
      await updateGroupImage(c.line, url);
      c.setImageUrl(url);
      c.invalidateConvMeta();
    } catch (e) {
      Alert.alert('Image upload failed', (e as Error).message ?? 'Unknown error');
    } finally { c.setUploadingImage(false); }
  };
}

export function makeSaveDescription(c: GroupHandlersCtx): () => Promise<void> {
  return async (): Promise<void> => {
    const next = c.descriptionDraft.trim();
    if (c.savingDescription) return;
    c.setSavingDescription(true);
    try {
      await updateGroupDescription(c.line, next);
      c.setDescription(next);
      c.setEditingDescription(false);
      c.invalidateConvMeta();
    } catch (e) {
      Alert.alert('Description update failed', (e as Error).message ?? 'Unknown error');
    } finally { c.setSavingDescription(false); }
  };
}

export function makeLeaveGroup(c: GroupHandlersCtx): (onClose: () => void) => void {
  return (onClose: () => void): void => {
    onClose();
    Alert.alert(
      'Leave group',
      'You’ll stop receiving messages from this group. You can be re-added by a member later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => { void runLeaveGroup(c); } },
      ],
    );
  };
}

async function runLeaveGroup(c: GroupHandlersCtx): Promise<void> {
  c.setLeaving(true);
  try {
    const result = await leaveGroupConv(c.line);
    flash(result === 'left' ? 'Left group' : 'Group hidden');
    c.router.replace('/');
  } catch (e) {
    Alert.alert('Couldn’t leave', (e as Error).message ?? 'Unknown error');
  } finally { c.setLeaving(false); }
}

export function makeSaveName(c: GroupHandlersCtx): () => Promise<void> {
  return async (): Promise<void> => {
    const next = c.draft.trim();
    if (!next || c.saving) return;
    c.setSaving(true);
    try {
      await updateGroupName(c.line, next);
      c.setName(next);
      c.setEditing(false);
      c.invalidateConvMeta();
    } catch (e) {
      Alert.alert('Rename failed', (e as Error).message ?? 'Unknown error');
    } finally { c.setSaving(false); }
  };
}
