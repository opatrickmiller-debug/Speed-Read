import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "leaflet/dist/leaflet.css";
import App from "@/App";

// ============================================
// AUTO-WAKE BACKEND SERVERS ON APP LOAD
// This runs immediately before React even renders
// ============================================
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const wakeBackendServers = async () => {
  const endpoints = [
    `${BACKEND_URL}/api/health`,
    `${BACKEND_URL}/api/`,
  ];
  
  console.log('[AutoWake] Starting backend wake-up...');
  
  // Fire multiple requests in parallel for faster wake-up
  const wakePromises = endpoints.map(async (endpoint) => {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
      });
      if (response.ok) {
        console.log(`[AutoWake] ✓ ${endpoint} is awake`);
        return true;
      }
    } catch (error) {
      console.log(`[AutoWake] Waking ${endpoint}...`);
    }
    return false;
  });
  
  // Also retry a few times with delays
  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (response.ok) {
        console.log('[AutoWake] ✓ Backend confirmed awake!');
        return true;
      }
    } catch (e) {
      // Server still waking up, wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  await Promise.allSettled(wakePromises);
  console.log('[AutoWake] Wake-up requests sent');
};

// Start waking servers immediately (don't await - let it run in background)
wakeBackendServers();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
