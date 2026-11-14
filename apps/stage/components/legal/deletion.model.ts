import { LEGAL_CONTACT, type LegalDoc } from './legal.model';

export const ACCOUNT_DELETION: LegalDoc = {
  title: 'Delete your Stage account',
  updated: 'November 14, 2026',
  intro:
    'You can delete your Stage account, and the data Stage keeps on its servers for it, at any time. This page explains how, and what is deleted.',
  sections: [
    {
      heading: 'In the app',
      paragraphs: [
        'Open Settings, then Advanced, then Delete account, and confirm. Stage deletes your username and st.box mail from its servers right away, stops notifications for that device, and removes the account, its keys and its messages from the device.',
        'If you are signed in on other devices, the account stays on them until you remove it there with Remove from this device.',
      ],
    },
    {
      heading: 'Without the app',
      paragraphs: [
        `Email ${LEGAL_CONTACT} with the subject "Delete my Stage account" and your username or address. We confirm the request with a message to that Stage account, so only its owner can delete it, and we complete it within 30 days. If you can no longer open the account, say so and we will find another way to check that it is yours.`,
      ],
    },
    {
      heading: 'What is deleted',
      paragraphs: [
        'Your Stage username, which is retired so nobody can take it after you. Your st.box mailbox and its mail. The notification registration of the device. The account, its keys and its messages on the device.',
      ],
    },
    {
      heading: 'What is kept',
      paragraphs: [
        'Messages you sent stay with the people you sent them to, as in any messenger.',
        'Records on public networks can not be erased by anyone: your address and its past username records on the Base blockchain, and profile pictures on IPFS.',
        'Encrypted files you sent stay available to the people in the chat. They are not linked to your account and we can not open them. Encrypted history archives are deleted within 3 days.',
        'Reports you sent, or that were made about you, may be kept as long as needed for safety and legal reasons.',
      ],
    },
    { heading: 'Contact', paragraphs: [`Questions about deleting your data: ${LEGAL_CONTACT}.`] },
  ],
};
