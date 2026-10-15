import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// Handle stale Vite dynamic chunk errors across deployments
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Preload error detected. Reloading page for new deployment assets...', event);
  window.location.reload();
});

window.addEventListener('error', (event) => {
  if (event?.message && event.message.includes('Failed to fetch dynamically imported module')) {
    console.warn('[Vite] Dynamic import module failed to fetch (stale cache). Reloading...', event);
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
