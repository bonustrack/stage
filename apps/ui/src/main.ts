import { createApp } from 'vue';
import { router } from './router';
import App from './App.vue';
import { installThemeClassEffect, setThemePreference } from './lib/theme';
import { installEmbedThemeBridge } from './lib/embedBridge';
import './style.css';

installThemeClassEffect();
installEmbedThemeBridge(setThemePreference);
createApp(App).use(router).mount('#app');
