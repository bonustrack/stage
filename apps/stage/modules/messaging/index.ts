export {
  XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer, convIdOfLine, shortAddress, isControlBody,
} from '../../lib/xmtp.types';

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
  peerEthAddressOfDm, memberInboxToAddressMap, groupMemberEthAddresses,
} from '../../lib/xmtp.identity';

export {
  listVisibleConversations,
  syncConversationsFromNetwork, acceptRequestConv,
  blockRequestConv, unacceptConv, getConvConsentState, streamNewConversations, streamConvConsent, syncConsent,
} from '../../lib/xmtp.conv';

export {
  createGroup, addGroupMembers, removeGroupMembers, updateGroupMeta, leaveGroupConv,
} from '../../lib/xmtp.groups';

export {
  xmtpSendText, xmtpReact, xmtpSendPoll,
  xmtpSendSignatureRequest, xmtpSendSignatureReference, xmtpSendTxRequest,
  xmtpSendTxReference, xmtpVote, xmtpOpenAnswer, xmtpReply, xmtpSendAttachment,
} from '../../lib/xmtp.messages';

export {
  xmtpSendMultiRemoteAttachment, resolveRemoteAttachment, fileUriToBase64,
} from '../../lib/xmtp.attachments';

export { subscribeAllMessages } from '../../lib/xmtp.stream';
export { useXmtpFeed } from '../../lib/xmtp.feed';

export { conversationIsSyncGroup } from '../../lib/xmtp.readSync';
export {
  MAX_LABELS, MAX_LABEL_LEN, LabelPermissionError, getGroupLabels, addGroupLabel, removeGroupLabel,
} from '../../lib/xmtp.labels';
export { suggestLabels } from '../../lib/xmtp.labels.suggest';

export { AccountManager, useActiveAccount, useActiveAccountRecord } from './account';
export {
  getActiveAccountIdSync, hydrateCachedRows, getCachedRows, setCachedRows, subscribeCachedRows,
  markConvRead, markConvUnread, patchRowSent, getXmtpBootstrapPhase, useXmtpBootstrapPhase,
} from './cache';
export { summarizeConversation, type ConversationView } from './conversation';
export { useConvConsentState } from './useConvConsent';
export { useGroupWaiting } from './useGroupWaiting';

export { messagingKeys, fetchGroupRoles, useConvMeta } from './queries';
export { ensureMessagingStreamSync } from './streamSync';
export { prefetchFeed } from './feedQuery';
