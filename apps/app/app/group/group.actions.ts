/** @file useGroupActions hook owning the group-detail mutation state and handlers (name, description, image, add/remove member, leave). */

import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { leaveGroupConv, shortAddress } from '../../modules/messaging';
import { flash } from '../../lib/toast';
import { uploadAvatar } from '../../lib/profile';
import {
  addGroupMember, removeGroupMember, updateGroupImage,
  updateGroupDescription, updateGroupName,
} from './group.helpers';

/** Hook wiring the editable group name/description state to mutation actions. */
export function useGroupActions(line: string, invalidateConvMeta: () => void): {
  name: string | null; setName: (n: string | null) => void;
  draft: string; setDraft: (s: string) => void;
  editing: boolean; setEditing: (b: boolean) => void; saving: boolean; saveName: () => Promise<void>;
  description: string; setDescription: (s: string) => void;
  descriptionDraft: string; setDescriptionDraft: (s: string) => void;
  editingDescription: boolean; setEditingDescription: (b: boolean) => void;
  savingDescription: boolean; saveDescription: () => Promise<void>;
  members: string[]; setMembers: (m: string[]) => void;
  addDraft: string; setAddDraft: (s: string) => void; adding: boolean; addMember: (onSuccess?: () => void) => Promise<void>;
  removing: string | null; removeMember: (addr: string) => void;
  imageUrl: string; setImageUrl: (s: string) => void; uploadingImage: boolean; pickImage: () => Promise<void>;
  leaving: boolean; leaveGroup: (onClose: () => void) => void;
} {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [addDraft, setAddDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [description, setDescription] = useState<string>('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);
  const [leaving, setLeaving] = useState(false);

  /** Add Member. */
  const addMember = async (onSuccess?: () => void): Promise<void> => {
    const addr = addDraft.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr) || adding) {
      Alert.alert('Add member', 'Enter a valid 0x… Ethereum address.');
      return;
    }
    setAdding(true);
    try {
      const next = await addGroupMember(line, addr);
      setAddDraft('');
      onSuccess?.();
      setMembers(next);
      invalidateConvMeta();
    } catch (e) {
      Alert.alert('Add member failed', (e as Error).message ?? 'Unknown error');
    } finally { setAdding(false); }
  };

  /** Remove Member. */
  const removeMember = (addr: string): void => {
    Alert.alert(
      'Remove member',
      `Remove ${shortAddress(addr)} from this group? They'll lose access to past + future messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: () => {
            void (async (): Promise<void> => {
              setRemoving(addr.toLowerCase());
              try {
                setMembers(await removeGroupMember(line, addr));
                invalidateConvMeta();
              } catch (e) {
                Alert.alert('Remove member failed', (e as Error).message ?? 'Unknown error');
              } finally { setRemoving(null); }
            })();
          },
        },
      ],
    );
  };

  /** Pick Image. */
  const pickImage = async (): Promise<void> => {
    if (uploadingImage) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', quality: 0.85, allowsMultipleSelection: false,
      /** Built-in square crop/resize step before upload — `allowsEditing` is part of expo-image-picker, no extra native dep. */
      allowsEditing: true, aspect: [1, 1],
    });
    const a = r.canceled ? undefined : r.assets[0];
    if (a === undefined) return;
    setUploadingImage(true);
    try {
      const url = await uploadAvatar(a.uri, a.mimeType ?? 'image/jpeg', a.fileName ?? 'group-avatar');
      await updateGroupImage(line, url);
      setImageUrl(url);
      invalidateConvMeta();
    } catch (e) {
      Alert.alert('Image upload failed', (e as Error).message ?? 'Unknown error');
    } finally { setUploadingImage(false); }
  };

  /** Set the Description. */
  const saveDescription = async (): Promise<void> => {
    const next = descriptionDraft.trim();
    if (savingDescription) return;
    setSavingDescription(true);
    try {
      await updateGroupDescription(line, next);
      setDescription(next);
      setEditingDescription(false);
      invalidateConvMeta();
    } catch (e) {
      Alert.alert('Description update failed', (e as Error).message ?? 'Unknown error');
    } finally { setSavingDescription(false); }
  };

  /** Leave the group from the info view — confirm, call the SDK (true leave when supported, else consent-deny hide), pop back to the conversation list. */
  const leaveGroup = (onClose: () => void): void => {
    onClose();
    Alert.alert(
      'Leave group',
      'You’ll stop receiving messages from this group. You can be re-added by a member later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave', style: 'destructive', onPress: () => {
            void (async (): Promise<void> => {
              setLeaving(true);
              try {
                const result = await leaveGroupConv(line);
                flash(result === 'left' ? 'Left group' : 'Group hidden');
                router.replace('/');
              } catch (e) {
                Alert.alert('Couldn’t leave', (e as Error).message ?? 'Unknown error');
              } finally { setLeaving(false); }
            })();
          },
        },
      ],
    );
  };

  /** Set the Name. */
  const saveName = async (): Promise<void> => {
    const next = draft.trim();
    if (!next || saving) return;
    setSaving(true);
    try {
      await updateGroupName(line, next);
      setName(next);
      setEditing(false);
      invalidateConvMeta();
    } catch (e) {
      Alert.alert('Rename failed', (e as Error).message ?? 'Unknown error');
    } finally { setSaving(false); }
  };

  return {
    name, setName, draft, setDraft, editing, setEditing, saving, saveName,
    description, setDescription, descriptionDraft, setDescriptionDraft,
    editingDescription, setEditingDescription, savingDescription, saveDescription,
    members, setMembers, addDraft, setAddDraft, adding, addMember,
    removing, removeMember, imageUrl, setImageUrl, uploadingImage, pickImage,
    leaving, leaveGroup,
  };
}
