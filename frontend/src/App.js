import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { useState, useEffect } from "react";

// Pages
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { FoodSearch } from "./pages/FoodSearch";
import { FoodLog } from "./pages/FoodLog";
import { MealPlans } from "./pages/MealPlans";
import { Favorites } from "./pages/Favorites";
import { Trends } from "./pages/Trends";
import { Settings } from "./pages/Settings";
import { BarcodeScanner } from "./pages/BarcodeScanner";
import { Suggestions } from "./pages/Suggestions";
import { MealBuilder } from "./pages/MealBuilder";
import { CustomFoods } from "./pages/CustomFoods";
import { MealLibrary } from "./pages/MealLibrary";
import { Loader2 } from "lucide-react";

// Components
import { Onboarding } from "./components/Onboarding";

// Protected Route Wrapper with Onboarding
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  useEffect(() => {
    if (user && !loading) {
      const onboardingCompleted = localStorage.getItem('onboarding_completed');
      if (!onboardingCompleted && !user.onboarding_completed) {
        setShowOnboarding(true);
      }
    }
  }, [user, loading]);
  
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-[#050505]' : 'bg-gray-50'}`}>
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }
  
  return children;
};

// Public Route Wrapper (redirect if logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-[#050505]' : 'bg-gray-50'}`}>
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      
      {/* Protected Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><FoodSearch /></ProtectedRoute>} />
      <Route path="/log" element={<ProtectedRoute><FoodLog /></ProtectedRoute>} />
      <Route path="/meal-plans" element={<ProtectedRoute><MealPlans /></ProtectedRoute>} />
      <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
      <Route path="/trends" element={<ProtectedRoute><Trends /></ProtectedRoute>} />
      <Route path="/barcode" element={<ProtectedRoute><BarcodeScanner /></ProtectedRoute>} />
      <Route path="/suggestions" element={<ProtectedRoute><Suggestions /></ProtectedRoute>} />
      <Route path="/meal-builder" element={<ProtectedRoute><MealBuilder /></ProtectedRoute>} />
      <Route path="/meal-library" element={<ProtectedRoute><MealLibrary /></ProtectedRoute>} />
      <Route path="/custom-foods" element={<ProtectedRoute><CustomFoods /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      
      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
            <ThemedToaster />
          </AuthProvider>
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}

// Themed toaster component
function ThemedToaster() {
  const { theme } = useTheme();
  
  return (
    <Toaster 
      position="top-right" 
      toastOptions={{
        style: theme === 'dark' ? {
          background: '#18181B',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#FAFAFA',
        } : {
          background: '#FFFFFF',
          border: '1px solid rgba(0,0,0,0.1)',
          color: '#18181B',
        },
      }}
    />
  );
}

export default App;
