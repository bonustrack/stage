/** @file Public barrel for the mobile app's local XMTP client lifecycle, re-exporting the cohesive `xmtp.*` sibling modules so existing `./xmtp` import sites resolve unchanged (client keys stay native-side in the SDK's sqlite, backed by the device keystore / secure enclave). */

export type {
  XmtpEnv, XmtpConsent, ConversationVersion, XmtpFeedStatus,
  LocalAttachmentInput, StreamMsg,
} from './xmtp.types';
export {
  XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer, convIdOfLine, metroConvIdOf, metroDmPeerOf,
  shortAddress, stampAvatarUrl,
} from './xmtp.types';

export {
  getOrCreateXmtpClient, ensureActiveAccount, switchToAccount, getCachedXmtpClient, waitForXmtpReady, deleteAccount,
  resetXmtpClient, getLastReadNs, setLastReadNs, markConvReadSynced,
  markConvUnreadSynced, syncPreferences, convOfLine, NoAccountError,
  listXmtpInstallations, revokeXmtpInstallation,
} from './xmtp.client';
export type { XmtpInstallation } from './xmtp.client';

export {
  primeInboxEthCache, peerEthAddressOfDm, memberInboxToAddressMap, groupMemberEthAddresses,
} from './xmtp.identity';

export {
  openDmWithAddress, listRequestConvs, acceptRequestConv, blockRequestConv,
  getConvConsentState, streamConvConsent, syncConsent,
} from './xmtp.conv';

export { createGroup, addGroupMembers, leaveGroupConv } from './xmtp.groups';

export {
  envelopeOfXmtpMessage, xmtpSendText, xmtpReact, xmtpSendPoll,
  xmtpSendSignatureRequest, xmtpSendSignatureReference, xmtpSendTxRequest,
  xmtpSendTxReference, xmtpVote, xmtpOpenAnswer, xmtpReply, xmtpSendAttachment,
} from './xmtp.messages';

export {
  swarmToHttp, xmtpSendMultiRemoteAttachment, resolveRemoteAttachment, fileUriToBase64,
} from './xmtp.attachments';

export { subscribeAllMessages } from './xmtp.stream';
export { useXmtpFeed } from './xmtp.feed';
