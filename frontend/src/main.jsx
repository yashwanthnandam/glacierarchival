import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Unregister any existing service workers to clear them
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
