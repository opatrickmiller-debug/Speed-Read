import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { InstallPrompt } from "@/components/InstallPrompt";
import SpeedMap from "@/pages/SpeedMap";

function App() {
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
