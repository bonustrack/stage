
export interface ConversationRequestView {
  convId: string;
  title: string;
  peerAddress: string | null;
  avatarAddress: string | null;
  avatarUri: string | null;
  preview: string;
  isGroup: boolean;
}

export interface RequestSummaryFields {
  convId: string;
  peerAddress: string | null;
  groupName: string;
  memberCount: number;
  groupImage: string | null;
  preview: string;
  stampSeed: string;
  shortPeer: string;
}

export function summarizeRequest(fields: RequestSummaryFields): ConversationRequestView {
  const isGroup = !fields.peerAddress;
  const trimmedName = fields.groupName.trim();
  const title = fields.peerAddress
    ? fields.shortPeer
    : (trimmedName === '' ? `${fields.memberCount + 1} members` : trimmedName);
  const trimmedImage = fields.groupImage?.trim() ?? '';
  const avatarUri = isGroup && trimmedImage !== '' ? trimmedImage : null;
  const avatarAddress = fields.peerAddress ?? (avatarUri ? null : fields.stampSeed);
  return {
    convId: fields.convId,
    title,
    peerAddress: fields.peerAddress,
    avatarAddress,
    avatarUri,
    preview: fields.preview.slice(0, 80),
    isGroup,
  };
}
