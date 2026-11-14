import { LEGAL_CONTACT, LEGAL_ENTITY, type LegalDoc } from './legal.model';

export const PRIVACY: LegalDoc = {
  title: 'Privacy Policy',
  updated: 'November 14, 2026',
  intro: `${LEGAL_ENTITY} makes Stage, a private, end-to-end encrypted messenger. We built it so that we can not read your messages. We do not sell data, show ads or use analytics, tracking or advertising IDs. This policy explains what Stage handles and why.`,
  sections: [
    {
      heading: 'Your account',
      paragraphs: [
        'Your account is a key created on your device. Its recovery phrase and private keys stay in the secure storage of your device and are never sent to us.',
        'Your account has a public address on the Base blockchain. It identifies you on the XMTP messaging network, so people can message you.',
      ],
    },
    {
      heading: 'Messages',
      paragraphs: [
        'Messages are end-to-end encrypted with the XMTP protocol and travel through the XMTP network, which is run by independent node operators. Only the people in a chat can read them. Neither we nor the node operators can.',
        'Photos, videos, voice messages and files are encrypted on your device before they are uploaded. We store the encrypted files on Cloudflare so the people in the chat can download them. We can not open them.',
        'When you add a device, your message history can move to it through an encrypted archive that we keep for at most 3 days.',
      ],
    },
    {
      heading: 'Your public profile',
      paragraphs: [
        'Your username, display name, picture and bio are public. Stage usernames are names on the Base blockchain, so they and your address are public and can not be erased from the blockchain. Profile pictures are stored on IPFS, a public file network. Avatars are shown through Stamp (cdn.stamp.fyi).',
      ],
    },
    {
      heading: 'Notifications',
      paragraphs: [
        'To notify you of new messages, your device sends our push server (push.stage.box) a push token from Google Firebase Cloud Messaging or Apple Push Notification service, an installation id and the ids of your chats. Notifications carry encrypted messages that the push server can not read. You can turn notifications off in Settings, which removes this registration.',
      ],
    },
    {
      heading: 'Link previews and maps',
      paragraphs: [
        'When a message contains a link, our server (proxy.stage.box, on Cloudflare) fetches the page to show a preview, so the website sees our server and not you. Previews are cached for a short time. When you share a location, it is sent inside an encrypted message, and the map preview is loaded from OpenStreetMap.',
      ],
    },
    {
      heading: 'Camera, microphone, photos and location',
      paragraphs: [
        'Stage uses the camera, microphone, your photos and your location only when you take a photo, record a voice message, pick something to send or share your location. Speech to text runs on your device.',
      ],
    },
    {
      heading: 'Reports',
      paragraphs: [
        'When you report a message or a person, you send us an encrypted message with a copy of the reported message, who sent it and the chat it was in. We use it to review the report and keep it as long as needed for that and for safety and legal reasons.',
      ],
    },
    {
      heading: 'Other features',
      paragraphs: [
        'Some versions of Stage include a self-custodial wallet. When you use it, your address and transactions go through blockchain providers (ZeroDev and Base RPC providers) and are public on the Base blockchain.',
        'If you claim an st.box mail address, mail sent to it is encrypted to your key when it arrives and stored on our servers until your devices download it.',
      ],
    },
    {
      heading: 'Service providers',
      paragraphs: [
        'We use Cloudflare (servers and storage), Fly.io (push server), Google Firebase Cloud Messaging and Apple Push Notification service (notifications), the XMTP network (messages), Base and ZeroDev (accounts and usernames), IPFS (profile pictures), Stamp (avatars) and OpenStreetMap (maps). They process data only to provide these services.',
      ],
    },
    {
      heading: 'Deleting your data',
      paragraphs: [
        'Settings, Advanced, Delete account deletes your Stage username and st.box mail from our servers, stops notifications for the device and removes the account, its keys and its messages from the device. Remove from this device only removes it from that device.',
        `You can also ask for deletion without the app by emailing ${LEGAL_CONTACT}. stage.box/#/delete-account explains both ways, and what is deleted and what is kept. Data on public blockchains and IPFS can not be erased by anyone.`,
      ],
    },
    { heading: 'Children', paragraphs: ['Stage is not for anyone under 18, and we do not knowingly collect data from children.'] },
    {
      heading: 'Your rights',
      paragraphs: [
        `Depending on where you live, you may have the right to access, correct, delete or move your data, and to object to how it is used. Email ${LEGAL_CONTACT} to use these rights. You can also complain to your data protection authority.`,
      ],
    },
    {
      heading: 'Changes and contact',
      paragraphs: [
        `We may update this policy and will change the date at the top when we do. ${LEGAL_ENTITY} is responsible for your data. Contact: ${LEGAL_CONTACT}.`,
      ],
    },
  ],
};
