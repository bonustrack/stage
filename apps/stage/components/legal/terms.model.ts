import { LEGAL_CONTACT, LEGAL_ENTITY, type LegalDoc } from './legal.model';

export const TERMS: LegalDoc = {
  title: 'Terms of Use',
  updated: 'November 14, 2026',
  intro: `Stage is a private, end-to-end encrypted messenger made by ${LEGAL_ENTITY} ("we", "us"). These terms apply to the Stage apps and to stage.box. By creating or importing an account, you agree to them.`,
  sections: [
    {
      heading: 'Who can use Stage',
      paragraphs: ['You must be at least 18 years old to use Stage. If you use Stage for an organization, you accept these terms for it.'],
    },
    {
      heading: 'Your account',
      paragraphs: [
        'Your account is a key created on your device and protected by a recovery phrase. We never receive your recovery phrase or keys, so we can not restore an account for you. Keep your recovery phrase private and backed up: anyone who has it controls your account.',
        'You are responsible for what is sent from your account.',
      ],
    },
    {
      heading: 'What is not allowed',
      paragraphs: [
        'Do not use Stage to:',
        '- share, request or promote child sexual abuse material, sexualize minors, or groom or exploit children in any way. We have zero tolerance for child sexual abuse and exploitation, and we report it to the National Center for Missing and Exploited Children and to law enforcement;',
        '- harass, bully, threaten or intimidate anyone, or encourage violence or self harm;',
        '- attack people for their race, ethnicity, religion, nationality, disability, sex, gender, sexual orientation or similar traits;',
        '- share sexual or intimate content of someone without their consent, or send sexual content to people who did not ask for it;',
        '- promote terrorism or violent extremism;',
        '- impersonate others, or mislead people about who you are;',
        '- send spam, run scams, phishing or fraud, or spread malware;',
        '- buy, sell or promote illegal goods or services;',
        "- break the law, or infringe other people's privacy, copyright or other rights.",
      ],
    },
    {
      heading: 'Reporting and blocking',
      paragraphs: [
        'You can report a message from its menu, and report a person from their profile. A report sends us a copy of the reported message, who sent it and the chat it was in, so we can review it. The person you report is not told.',
        'You can block a person from their profile or when you report their message in a direct chat. They can then no longer message you directly. Channel admins can remove members and delete messages in their channels, and you can leave any channel.',
      ],
    },
    {
      heading: 'How we enforce these terms',
      paragraphs: [
        'Messages are end-to-end encrypted, so we only see a message when someone reports it to us. When we find that someone broke these terms, we may take away their Stage username, stop our services for their account (such as push notifications, attachments, link previews and usernames), remove them from channels we run, and report them to the authorities when the law requires it or when someone is in danger.',
      ],
    },
    {
      heading: 'Usernames',
      paragraphs: [
        'Stage usernames are free and public. We may take back a username that impersonates someone, infringes a right, misleads people or is used to break these terms.',
      ],
    },
    {
      heading: 'Agents and other people',
      paragraphs: [
        'Some contacts are agents run by other people or companies. We do not control what other people or agents send, and we are not responsible for it. Be careful with links, files and requests from people you do not know.',
      ],
    },
    {
      heading: 'No warranty',
      paragraphs: [
        'Stage is provided as is, without warranties of any kind. To the extent the law allows, we are not liable for indirect or consequential damages, or for lost data, keys or messages. Nothing in these terms limits rights you have under the law of your country that can not be limited.',
      ],
    },
    {
      heading: 'Changes and ending',
      paragraphs: [
        'We may update these terms. The date at the top shows the latest version, and continuing to use Stage after a change means you accept it. You can stop using Stage and delete your account at any time.',
      ],
    },
    { heading: 'Contact', paragraphs: [`Questions, reports or legal requests: ${LEGAL_CONTACT}.`] },
  ],
};
