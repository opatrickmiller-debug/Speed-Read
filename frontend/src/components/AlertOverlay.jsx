import { useEffect, useRef, useCallback } from "react";
import { AlertTriangle, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

export const AlertOverlay = ({ 
  isActive, 
  audioEnabled, 
  voiceEnabled,
  currentSpeed,
  speedLimit,
  speedUnit,
  onMuteClick 
}) => {
  const audioRef = useRef(null);
  const voiceSpokenRef = useRef(false);
  const lastVoiceTimeRef = useRef(0);
  
  // Voice announcement function
  const speakAlert = useCallback((message) => {
    if (!('speechSynthesis' in window)) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Try to use a clear voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.name.includes('Google') || 
      v.name.includes('Samantha') || 
      v.name.includes('Daniel') ||
      v.lang.startsWith('en')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  }, []);

  // Voice alert effect - speaks when speeding starts
  useEffect(() => {
    if (isActive && voiceEnabled) {
      const now = Date.now();
      // Only speak once when speeding starts, then every 10 seconds if still speeding
      if (!voiceSpokenRef.current || (now - lastVoiceTimeRef.current > 10000)) {
        const speedOver = Math.round(currentSpeed - speedLimit);
        const message = speedOver > 10 
          ? `Warning! You are ${speedOver} ${speedUnit === 'mph' ? 'miles per hour' : 'kilometers per hour'} over the limit. Slow down immediately.`
          : `Speed alert. You are exceeding the speed limit.`;
        
        speakAlert(message);
        voiceSpokenRef.current = true;
        lastVoiceTimeRef.current = now;
      }
    } else {
      voiceSpokenRef.current = false;
    }
  }, [isActive, voiceEnabled, currentSpeed, speedLimit, speedUnit, speakAlert]);

  // Load voices on mount (needed for some browsers)
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

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

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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
        {(audioEnabled || voiceEnabled) && (
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
      
      {/* Speed info banner */}
      <div className="absolute bottom-0 left-0 right-0 bg-red-900/80 backdrop-blur-sm py-2 px-4">
        <div className="flex items-center justify-center gap-4 text-white font-mono text-sm">
          <span>Current: <strong className="text-lg">{Math.round(currentSpeed)}</strong> {speedUnit}</span>
          <span className="text-red-300">|</span>
          <span>Limit: <strong className="text-lg">{speedLimit}</strong> {speedUnit}</span>
          <span className="text-red-300">|</span>
          <span className="text-yellow-300">Over by: <strong className="text-lg">+{Math.round(currentSpeed - speedLimit)}</strong></span>
        </div>
      </div>
      
      {/* Corner flashes */}
      <div className="absolute top-16 left-4 w-4 h-4 bg-red-500 animate-ping" />
      <div className="absolute top-16 right-4 w-4 h-4 bg-red-500 animate-ping" />
      <div className="absolute bottom-16 left-4 w-4 h-4 bg-red-500 animate-ping" />
      <div className="absolute bottom-16 right-4 w-4 h-4 bg-red-500 animate-ping" />
    </div>
  );
};
