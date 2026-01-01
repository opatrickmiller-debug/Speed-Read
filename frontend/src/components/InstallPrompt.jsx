import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) {
        return; // Don't show for 24 hours after dismissal
      }
    }

    // Listen for install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (!showPrompt || isInstalled) return null;

  return (
    <div 
      data-testid="install-prompt"
      className={cn(
        "fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80",
        "backdrop-blur-xl bg-zinc-900/95 border border-zinc-700",
        "rounded-lg shadow-2xl p-4 z-50",
        "animate-in slide-in-from-bottom-4 duration-300"
      )}
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-zinc-300"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
          <Download className="w-6 h-6 text-sky-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm">
            Install DriveCoach
          </h3>
          <p className="text-zinc-400 text-xs mt-1">
            Add to home screen for quick access and offline use
          </p>
          
          <div className="flex gap-2 mt-3">
            <Button
              data-testid="install-btn"
              onClick={handleInstall}
              size="sm"
              className="bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/50 text-xs"
            >
              Install
            </Button>
            <Button
              onClick={handleDismiss}
              size="sm"
              variant="ghost"
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
