import { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';

export const InstallPrompt = () => {
  const { theme } = useTheme();
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Don't show if already installed or dismissed recently
    if (standalone) return;
    
    const dismissed = localStorage.getItem('pwa_prompt_dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Don't show for 7 days after dismissal
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Listen for beforeinstallprompt (Android/Desktop Chrome)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after user has used the app a bit
      setTimeout(() => setShowPrompt(true), 30000); // 30 seconds
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // For iOS, show prompt after delay
    if (iOS && !standalone) {
      setTimeout(() => setShowPrompt(true), 30000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className={cn(
      "fixed bottom-20 left-4 right-4 z-50 animate-slide-up",
      "md:left-auto md:right-4 md:bottom-4 md:w-80"
    )}>
      <div className={cn(
        "rounded-2xl border shadow-2xl p-4",
        theme === 'dark' 
          ? 'bg-zinc-900 border-white/10' 
          : 'bg-white border-gray-200'
      )}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <img 
              src="/icons/icon-96x96.png" 
              alt="Isotope" 
              className="w-8 h-8 rounded"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "font-semibold",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Install Isotope
            </h3>
            <p className={cn(
              "text-sm mt-0.5",
              theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
            )}>
              {isIOS 
                ? 'Add to Home Screen for the best experience'
                : 'Install for quick access and offline use'
              }
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              theme === 'dark' 
                ? 'hover:bg-white/10 text-zinc-400' 
                : 'hover:bg-gray-100 text-gray-500'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isIOS ? (
          <div className={cn(
            "mt-3 pt-3 border-t text-sm",
            theme === 'dark' ? 'border-white/10 text-zinc-400' : 'border-gray-200 text-gray-600'
          )}>
            <p className="flex items-center gap-2">
              <span>Tap</span>
              <Share className="w-4 h-4 text-blue-500" />
              <span>then "Add to Home Screen"</span>
            </p>
          </div>
        ) : (
          <button
            onClick={handleInstall}
            className="w-full mt-3 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-2.5 rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            Install App
          </button>
        )}
      </div>
    </div>
  );
};
