import "@/App.css";
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { InstallPrompt } from "@/components/InstallPrompt";
import SpeedMap from "@/pages/SpeedMap";
import LandingPage from "@/pages/LandingPage";
import SharedProgress from "@/pages/SharedProgress";

function App() {
  // Check if user has visited the app before
  const [showLanding, setShowLanding] = useState(() => {
    const hasVisited = localStorage.getItem('hasVisitedApp');
    const directToApp = window.location.search.includes('app=1');
    // Also check if accessing shared progress page
    const isSharedProgress = window.location.pathname.startsWith('/progress/');
    return !hasVisited && !directToApp && !isSharedProgress;
  });

  const enterApp = () => {
    localStorage.setItem('hasVisitedApp', 'true');
    setShowLanding(false);
  };

  // If showing landing page, render it (but not for shared progress pages)
  if (showLanding && !window.location.pathname.startsWith('/progress/')) {
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
            <Route path="/progress/:shareCode" element={<SharedProgress />} />
          </Routes>
        </BrowserRouter>
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
        <InstallPrompt />
      </div>
    </AuthProvider>
  );
}

export default App;
