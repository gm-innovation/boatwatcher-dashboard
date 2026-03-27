import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { DesktopFatalErrorBoundary } from './components/desktop/DesktopFatalErrorBoundary';
import './index.css';

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DesktopFatalErrorBoundary>
      <App />
    </DesktopFatalErrorBoundary>
  </React.StrictMode>
);

// Signal to Electron main process that the renderer has loaded successfully
try {
  if ((window as any).electronAPI?.appReady) {
    (window as any).electronAPI.appReady();
  }
} catch (_) {
  // Silently ignore — not running in Electron
}
