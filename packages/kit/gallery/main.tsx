import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import calibreMedium from '../../../apps/stage/assets/fonts/Calibre-Medium-Custom.ttf';
import calibreSemibold from '../../../apps/stage/assets/fonts/Calibre-Semibold-Custom.ttf';
import { collectStories, type StoryModule } from './story';
import { App } from './App';

const fonts = document.createElement('style');
fonts.textContent = [
  `@font-face { font-family: 'Calibre-Medium'; src: url('${calibreMedium}') format('truetype'); }`,
  `@font-face { font-family: 'Calibre-Semibold'; src: url('${calibreSemibold}') format('truetype'); }`,
].join('\n');
document.head.appendChild(fonts);

const stories = collectStories(import.meta.glob<StoryModule>('../stories/*.stories.tsx', { eager: true }));

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><App stories={stories} /></StrictMode>);
