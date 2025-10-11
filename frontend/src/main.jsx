import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Register Service Worker (temporarily disabled to prevent interference)
if (false && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
      })
      .catch((registrationError) => {
      });
  });
}

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