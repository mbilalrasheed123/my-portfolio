import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress Vite HMR websocket errors and THREE.Clock deprecation warnings
if (typeof window !== 'undefined') {
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args) => {
    if (args[0]?.toString().includes('[vite] failed to connect to websocket')) return;
    originalError(...args);
  };

  console.warn = (...args) => {
    if (args[0]?.toString().includes('THREE.Clock: This module has been deprecated')) return;
    originalWarn(...args);
  };

  // Guard against "Cannot set property fetch of #<Window> which has only a getter"
  // This often happens in iframe environments when libraries try to polyfill fetch.
  // The primary suppression is now in index.html, this is a secondary guard.
  window.addEventListener('error', (event) => {
    if (event.message?.includes('Cannot set property fetch') || 
        event.error?.message?.includes('Cannot set property fetch')) {
      event.preventDefault();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.toString().includes('WebSocket closed without opened')) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
