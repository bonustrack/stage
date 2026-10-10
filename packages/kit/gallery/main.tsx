import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { collectStories, type StoryModule } from './story';
import { App } from './App';

const stories = collectStories(import.meta.glob<StoryModule>('../stories/*.stories.tsx', { eager: true }));

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><App stories={stories} /></StrictMode>);
