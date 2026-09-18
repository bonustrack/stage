

export type {
  XmtpEnv, XmtpConsent, ConversationVersion, XmtpFeedStatus,
  LocalAttachmentInput, StreamMsg,
} from '../../lib/xmtp.types';
export {
  XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer, convIdOfLine, stageConvIdOf, stageDmPeerOf,
  shortAddress, stampAvatarUrl, isControlBody,
} from '../../lib/xmtp.types';

export {
  getOrCreateXmtpClient, xmtpClient, ensureActiveAccount, switchToAccount, getCachedXmtpClient, waitForXmtpReady, deleteAccount,
  resetActiveXmtpStore, getLastReadNs, setLastReadNs, getMarkedUnread, setMarkedUnreadFlag, markConvReadSynced,
  markConvUnreadSynced, syncPreferences, convOfLine, NoAccountError,
  listXmtpInstallations, revokeXmtpInstallation, selfEthAddress, cachedSelfEthAddress,
} from '../../lib/xmtp.client';
export type { XmtpInstallation } from '../../lib/xmtp.client';

export {
  primeInboxEthCache, primeConversationMembers, isGroupConv,
  peerEthAddressOfDm, memberInboxToAddressMap, groupMemberEthAddresses,
} from '../../lib/xmtp.identity';

export {
  openDmWithAddress, findExistingDmWithAddress, repairDmMembership, dmUnreachableReason,
  listVisibleConversations,
  syncConversationsFromNetwork, acceptRequestConv,
  blockRequestConv, getConvConsentState, streamNewConversations, streamConvConsent, syncConsent,
} from '../../lib/xmtp.conv';

export {
  createGroup, addGroupMembers, removeGroupMembers, updateGroupMeta, groupAdminInboxIds, leaveGroupConv,
} from '../../lib/xmtp.groups';

export {
  envelopeOfXmtpMessage, xmtpSendText, xmtpReact, xmtpSendPoll,
  xmtpSendSignatureRequest, xmtpSendSignatureReference, xmtpSendTxRequest,
  xmtpSendTxReference, xmtpVote, xmtpOpenAnswer, xmtpReply, xmtpSendAttachment,
} from '../../lib/xmtp.messages';

export {
  swarmToHttp, xmtpSendMultiRemoteAttachment, resolveRemoteAttachment, fileUriToBase64,
} from '../../lib/xmtp.attachments';

export { subscribeAllMessages } from '../../lib/xmtp.stream';
export { useXmtpFeed } from '../../lib/xmtp.feed';

export { conversationIsSyncGroup } from '../../lib/xmtp.readSync';
export * from '../../lib/xmtp.labels';
export * from '../../lib/xmtp.labels.suggest';

export * from './account';
export * from './cache';
export * from './conversation';

export * from './queries';
export * from './streamSync';
export * from './feedQuery';
