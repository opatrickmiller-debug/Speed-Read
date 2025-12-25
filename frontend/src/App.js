import "@/App.css";
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { InstallPrompt } from "@/components/InstallPrompt";
import SpeedMap from "@/pages/SpeedMap";
import LandingPage from "@/pages/LandingPage";

function App() {
  // Check if user has visited the app before
  const [showLanding, setShowLanding] = useState(() => {
    const hasVisited = localStorage.getItem('hasVisitedApp');
    const directToApp = window.location.search.includes('app=1');
    return !hasVisited && !directToApp;
  });

  const enterApp = () => {
    localStorage.setItem('hasVisitedApp', 'true');
    setShowLanding(false);
  };

  // If showing landing page, render it
  if (showLanding) {
    return (
      <div className="App">
        <LandingPage onEnterApp={enterApp} />
        <Toaster 
          position="bottom-left"
          toastOptions={{
            style: {
              background: 'rgba(0, 0, 0, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              fontFamily: 'JetBrains Mono, monospace',
              pointerEvents: 'none', // Don't block interactions
            },
          }}
        />
      </div>
    );
  }

  return (
    <AuthProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<SpeedMap />} />
          </Routes>
        </BrowserRouter>
        <Toaster 
          position="top-center"
          toastOptions={{
            style: {
              background: 'rgba(0, 0, 0, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              fontFamily: 'JetBrains Mono, monospace',
            },
          }}
        />
        <InstallPrompt />
      </div>
    </AuthProvider>
  );
}

export default App;
