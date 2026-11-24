import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    window.__iismmDeferredPrompt = e as any;
  });
  if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/dev-sw.js?dev-sw', { scope: '/', type: 'classic' }).catch(() => null);
  } else {
    registerSW({ immediate: true });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
