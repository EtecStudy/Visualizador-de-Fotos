import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Dev-only debugging hook (never bundled in production).
if (import.meta.env.DEV) {
  void Promise.all([import('./core/upscale'), import('./core/render/photoRenderer'), import('./state/useAppStore')]).then(
    ([upscale, renderer, store]) => {
      (window as unknown as Record<string, unknown>).__lumina = { upscale, renderer, store };
    },
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
