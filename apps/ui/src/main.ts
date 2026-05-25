import { createApp } from 'vue';
import { router } from './router';
import App from './App.vue';
import { installThemeClassEffect } from './lib/theme';
import './style.css';

installThemeClassEffect();
createApp(App).use(router).mount('#app');
