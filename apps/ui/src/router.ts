import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'activity', component: () => import('./pages/Activity.vue') },
  { path: '/lines', name: 'lines', component: () => import('./pages/Lines.vue') },
  { path: '/settings', name: 'settings', component: () => import('./pages/Settings.vue') },
  { path: '/event/:id', name: 'event', component: () => import('./pages/EventDetail.vue') },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
