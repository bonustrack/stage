/** Contacts route — a 5th bottom-tab entry. Unlike the four pager tabs
 *  (index/wallet/notifications/profile) it is NOT part of the swipe pager: it
 *  renders its own full screen (the pager overlay is hidden on /contacts, same
 *  as /settings), so the 4-page swipe strip stays untouched. Lists every user
 *  the account has access to — DM peers + group members. */

import { ContactsScreen } from '../../components/ContactsScreen';

export default function ContactsRoute(): React.ReactElement {
  return <ContactsScreen />;
}
