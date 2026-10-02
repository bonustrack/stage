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
export { afterFirstPages } from '../../lib/feedLines';

export {
  primeConversationMembers, isGroupConv,
  peerEthAddressOfDm, memberInboxToAddressMap, groupMemberEthAddresses, inboxEthAddresses,
} from '../../lib/xmtp.identity';

export {
  listVisibleConversations,
  syncConversationsFromNetwork, acceptRequestConv,
  blockRequestConv, unacceptConv, getConvConsentState, streamNewConversations, streamConvConsent, syncConsent,
  checkConvSync, conversationIsSyncGroup, createdBySelf,
} from '../../lib/xmtp.conv';

export { createGroup, leaveGroupConv, groupEditRights } from '../../lib/xmtp.groups';
export {
  addGroupMembers, removeGroupMembers, updateGroupMeta, addGroupLabel, removeGroupLabel, moveGroupLabel,
  renameGroupLabel, updateGroupAssigned, suggestLabels, setGroupCategory, knownCategories,
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

export { MAX_LABELS, MAX_LABEL_LEN, LabelPermissionError, categoryOf, cleanLabel } from '@stage-labs/client/xmtp/labels';

export { AccountManager, useActiveAccount, useActiveAccountRecord } from './account';
export {
  getActiveAccountIdSync, hydrateCachedRows, getCachedRows, setCachedRows, subscribeCachedRows,
  markConvRead, markConvUnread, patchRowSent,
} from '../../lib/channelsCache';
export { getXmtpBootstrapPhase, useXmtpBootstrapPhase } from '../../lib/xmtp.state.core';
export { summarizeConversation, type ConversationView } from './conversation';
export { rememberOwnGroup, useConvConsentState, useGroupAccess } from './useConvConsent';

export { messagingKeys, fetchGroupRoles, useConvMeta, useConvMetas, invalidateConvMeta } from './queries';
export { ensureMessagingStreamSync } from './streamSync';
export { prefetchFeed } from './feedQuery';
