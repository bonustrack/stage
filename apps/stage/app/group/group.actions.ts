
import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  type GroupHandlersCtx, type GroupPickedFile,
  makeAddMember, makeRemoveMember, makeUploadGroupImage,
  makeSaveDescription, makeLeaveGroup, makeSaveName,
} from './group.actions.handlers';

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
  imageUrl: string; setImageUrl: (s: string) => void; uploadingImage: boolean;
  pickImage: () => void; pickNonce: number; onPickedImage: (file: GroupPickedFile) => Promise<void>;
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
  const [pickNonce, setPickNonce] = useState(0);
  const [description, setDescription] = useState<string>('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const ctx: GroupHandlersCtx = {
    line, invalidateConvMeta, router,
    addDraft, adding, setAdding, setAddDraft, setMembers,
    removing, setRemoving,
    uploadingImage, setUploadingImage, setImageUrl,
    descriptionDraft, savingDescription, setSavingDescription, setDescription, setEditingDescription,
    draft, saving, setSaving, setName, setEditing, setLeaving,
  };
  const addMember = makeAddMember(ctx);
  const removeMember = makeRemoveMember(ctx);
  const onPickedImage = makeUploadGroupImage(ctx);
  const pickImage = (): void => { if (!uploadingImage) setPickNonce(n => n + 1); };
  const saveDescription = makeSaveDescription(ctx);
  const leaveGroup = makeLeaveGroup(ctx);
  const saveName = makeSaveName(ctx);

  return {
    name, setName, draft, setDraft, editing, setEditing, saving, saveName,
    description, setDescription, descriptionDraft, setDescriptionDraft,
    editingDescription, setEditingDescription, savingDescription, saveDescription,
    members, setMembers, addDraft, setAddDraft, adding, addMember,
    removing, removeMember, imageUrl, setImageUrl, uploadingImage,
    pickImage, pickNonce, onPickedImage,
    leaving, leaveGroup,
  };
}
