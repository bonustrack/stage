import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/',          redirect: '/channels' },
  { path: '/channels',  name: 'channels',  component: () => import('./pages/Channels.vue') },
  { path: '/contacts',  name: 'contacts',  component: () => import('./pages/Contacts.vue') },
  { path: '/settings',  name: 'settings',  component: () => import('./pages/Settings.vue') },
  { path: '/profile',   name: 'profile',   component: () => import('./pages/Profile.vue') },
  { path: '/user/:address', name: 'user',  component: () => import('./pages/UserProfile.vue') },
  { path: '/group/:convId', name: 'group', component: () => import('./pages/GroupDetail.vue') },
  { path: '/xmtp/:convId', name: 'xmtp',   component: () => import('./pages/XmtpConversation.vue') },
  { path: '/embed/:convId', name: 'embed',  component: () => import('./pages/XmtpConversation.vue') },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
