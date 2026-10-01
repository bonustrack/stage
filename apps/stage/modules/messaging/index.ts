export {
  XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer, convIdOfLine, shortAddress, isControlBody,
} from '../../lib/xmtp.types';
export type { LocalAttachmentInput } from '../../lib/xmtp.types';

export {
  getOrCreateXmtpClient, xmtpClient, deleteAccount,
  resetActiveXmtpStore, syncPreferences,
  listXmtpInstallations, revokeXmtpInstallation, selfEthAddress, cachedSelfEthAddress,
} from '../../lib/xmtp.client';
export { NoAccountError, type XmtpInstallation } from '../../lib/xmtp.client.core';
export { ensureActiveAccount } from '../../lib/xmtp.recover.core';
export { convOfLine } from '../../lib/xmtp.sdk';

export {
  primeConversationMembers, isGroupConv,
  peerEthAddressOfDm, memberInboxToAddressMap, groupMemberEthAddresses, inboxEthAddresses,
} from '../../lib/xmtp.identity';

export {
  listVisibleConversations,
  syncConversationsFromNetwork, acceptRequestConv,
  blockRequestConv, unacceptConv, getConvConsentState, streamNewConversations, streamConvConsent, syncConsent,
} from '../../lib/xmtp.conv';

export { createGroup, leaveGroupConv, groupEditRights } from '../../lib/xmtp.groups';
export {
  addGroupMembers, removeGroupMembers, updateGroupMeta, addGroupLabel, removeGroupLabel, moveGroupLabel,
  renameGroupLabel, updateGroupAssigned,
} from './groupRow';

export {
  xmtpSendText, xmtpReact, xmtpSendPoll,
  xmtpSendSignatureRequest, xmtpSendSignatureReference, xmtpSendTxRequest,
  xmtpSendTxReference, xmtpSendFrameAction, xmtpVote, xmtpOpenAnswer, xmtpReply, xmtpDeleteMessage,
} from '../../lib/xmtp.messages';

export {
  xmtpSendMultiRemoteAttachment, resolveRemoteAttachment, prepareAttachments, uploadAttachments, forgetAttachments,
} from '../../lib/xmtp.attachments';

export { subscribeAllMessages } from '../../lib/xmtp.stream';
export { useXmtpFeed } from '../../lib/xmtp.feed';

export { conversationIsSyncGroup } from '../../lib/xmtp.readSync';
export {
  MAX_LABELS, MAX_LABEL_LEN, LabelPermissionError, getGroupLabels,
} from '../../lib/xmtp.labels';
export { suggestLabels } from '../../lib/xmtp.labels.suggest';

export { AccountManager, useActiveAccount, useActiveAccountRecord } from './account';
export {
  getActiveAccountIdSync, hydrateCachedRows, getCachedRows, setCachedRows, subscribeCachedRows,
  markConvRead, markConvUnread, patchRowSent, getXmtpBootstrapPhase, useXmtpBootstrapPhase,
} from './cache';
export { summarizeConversation, type ConversationView } from './conversation';
export { useConvConsentState } from './useConvConsent';
export { useGroupAccess } from './useGroupAccess';

export { messagingKeys, fetchGroupRoles, useConvMeta, useConvMetas, invalidateConvMeta } from './queries';
export { ensureMessagingStreamSync } from './streamSync';
export { prefetchFeed } from './feedQuery';
