import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/',          redirect: '/channels' },
  { path: '/channels',  name: 'channels',  component: () => import('./views/Channels.vue') },
  { path: '/contacts',  name: 'contacts',  component: () => import('./views/Contacts.vue') },
  { path: '/settings',  name: 'settings',  component: () => import('./views/Settings.vue') },
  { path: '/profile',   name: 'profile',   component: () => import('./views/Profile.vue') },
  { path: '/user/:address', name: 'user',  component: () => import('./views/UserProfile.vue') },
  { path: '/group/:convId', name: 'group', component: () => import('./views/GroupDetail.vue') },
  { path: '/xmtp/new-group', name: 'xmtp-new-group', component: () => import('./views/XmtpNewGroup.vue') },
  { path: '/xmtp/archived',  name: 'xmtp-archived',  component: () => import('./views/XmtpArchived.vue') },
  { path: '/xmtp/requests',  name: 'xmtp-requests',  component: () => import('./views/XmtpRequests.vue') },
  { path: '/xmtp/:convId/add-members', name: 'xmtp-add-members', component: () => import('./views/XmtpAddMembers.vue') },
  { path: '/xmtp/:convId', name: 'xmtp',   component: () => import('./views/XmtpConversation.vue') },
  { path: '/embed/:convId', name: 'embed',  component: () => import('./views/XmtpConversation.vue') },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
