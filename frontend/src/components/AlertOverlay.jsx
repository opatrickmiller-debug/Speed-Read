import { useEffect, useRef } from "react";
import { AlertTriangle, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

export const AlertOverlay = ({ isActive, audioEnabled, onMuteClick }) => {
  const audioRef = useRef(null);
  
  // Play alarm sound when active
  useEffect(() => {
    if (isActive && audioEnabled) {
      // Create oscillator-based alarm sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'square';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      
      // Modulate frequency for alarm effect
      const interval = setInterval(() => {
        oscillator.frequency.value = oscillator.frequency.value === 800 ? 600 : 800;
      }, 300);
      
      audioRef.current = { oscillator, audioContext, interval };
      
      return () => {
        clearInterval(interval);
        oscillator.stop();
        audioContext.close();
      };
    } else if (audioRef.current) {
      const { oscillator, audioContext, interval } = audioRef.current;
      clearInterval(interval);
      oscillator.stop();
      audioContext.close();
      audioRef.current = null;
    }
  }, [isActive, audioEnabled]);

  if (!isActive) return null;

  return (
    <div 
      data-testid="alert-overlay"
      className={cn(
        "fixed inset-0 pointer-events-none z-50",
        "border-[8px] border-red-500",
        "animate-pulse"
      )}
      style={{
        boxShadow: "inset 0 0 100px rgba(239, 68, 68, 0.3)"
      }}
    >
      {/* Top alert banner */}
      <div 
        className={cn(
          "absolute top-0 left-0 right-0",
          "bg-red-500/90 backdrop-blur-sm",
          "py-3 px-6",
          "flex items-center justify-center gap-3",
          "pointer-events-auto"
        )}
      >
        <AlertTriangle className="w-6 h-6 text-white animate-bounce" />
        <span className="text-white font-black uppercase tracking-wider text-lg font-chivo">
          SPEED ALERT
        </span>
        <AlertTriangle className="w-6 h-6 text-white animate-bounce" />
        
        {/* Mute button */}
        {audioEnabled && (
          <button
            data-testid="mute-alert-btn"
            onClick={onMuteClick}
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2",
              "p-2 rounded-full bg-white/20 hover:bg-white/30",
              "transition-colors"
            )}
          >
            <VolumeX className="w-5 h-5 text-white" />
          </button>
        )}
      </div>
      
      {/* Corner flashes */}
      <div className="absolute top-16 left-4 w-4 h-4 bg-red-500 animate-ping" />
      <div className="absolute top-16 right-4 w-4 h-4 bg-red-500 animate-ping" />
      <div className="absolute bottom-4 left-4 w-4 h-4 bg-red-500 animate-ping" />
      <div className="absolute bottom-4 right-4 w-4 h-4 bg-red-500 animate-ping" />
    </div>
  );
};
