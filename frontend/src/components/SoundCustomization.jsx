import { useState, useRef, useEffect } from "react";
import { Volume2, Play, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

// Alert sound options
export const ALERT_SOUNDS = [
  { id: "beep", name: "Classic Beep", frequency: 800, pattern: [200, 100, 200] },
  { id: "chime", name: "Gentle Chime", frequency: 600, pattern: [300, 150, 300, 150, 300] },
  { id: "urgent", name: "Urgent Alert", frequency: 1000, pattern: [100, 50, 100, 50, 100, 50, 100] },
  { id: "ping", name: "Soft Ping", frequency: 500, pattern: [150] },
  { id: "siren", name: "Mini Siren", frequency: 700, pattern: [400], sweep: true },
  { id: "double", name: "Double Tap", frequency: 900, pattern: [80, 80, 80] },
];

// Audio context singleton
let audioContext = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

// Play a specific alert sound
export const playAlertSound = (soundId, volume = 0.7) => {
  const sound = ALERT_SOUNDS.find(s => s.id === soundId) || ALERT_SOUNDS[0];
  const ctx = getAudioContext();
  
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);

  let time = ctx.currentTime;
  
  sound.pattern.forEach((duration, index) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    
    if (sound.sweep) {
      // Siren effect - sweep frequency
      oscillator.frequency.setValueAtTime(sound.frequency, time);
      oscillator.frequency.linearRampToValueAtTime(sound.frequency * 1.5, time + duration / 1000);
    } else {
      oscillator.frequency.value = sound.frequency + (index * 50);
    }
    
    oscillator.type = 'sine';
    
    // Envelope
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(1, time + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, time + duration / 1000);
    
    oscillator.start(time);
    oscillator.stop(time + duration / 1000 + 0.05);
    
    time += duration / 1000 + 0.05;
  });
};

// Escalating alert - gets louder/faster as speed increases over limit
export const playEscalatingAlert = (soundId, speedOverLimit, maxOver = 20, baseVolume = 0.5) => {
  const intensity = Math.min(1, speedOverLimit / maxOver);
  const volume = baseVolume + (intensity * 0.5); // 0.5 to 1.0
  
  playAlertSound(soundId, Math.min(1, volume));
  
  // If very over limit, play multiple times
  if (intensity > 0.5) {
    setTimeout(() => playAlertSound(soundId, volume * 0.8), 300);
  }
  if (intensity > 0.8) {
    setTimeout(() => playAlertSound(soundId, volume * 0.6), 600);
  }
};

// Sound selector component for settings
export function SoundSelector({ selectedSound, onSelect, volume, onVolumeChange }) {
  const [playing, setPlaying] = useState(null);

  const previewSound = (soundId) => {
    setPlaying(soundId);
    playAlertSound(soundId, volume);
    setTimeout(() => setPlaying(null), 1000);
  };

  return (
    <div className="space-y-4">
      {/* Volume Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-mono">Alert Volume</span>
          <span className="text-xs text-orange-400 font-mono">{Math.round(volume * 100)}%</span>
        </div>
        <div className="flex items-center gap-3">
          <Volume2 className="w-4 h-4 text-zinc-500" />
          <Slider
            value={[volume * 100]}
            onValueChange={(v) => onVolumeChange(v[0] / 100)}
            max={100}
            min={10}
            step={5}
            className="flex-1 [&_[role=slider]]:bg-orange-500"
          />
        </div>
      </div>

      {/* Sound Options */}
      <div className="space-y-2">
        <span className="text-xs text-zinc-500 font-mono">Alert Sound</span>
        <div className="grid grid-cols-2 gap-2">
          {ALERT_SOUNDS.map((sound) => (
            <button
              key={sound.id}
              onClick={() => {
                onSelect(sound.id);
                previewSound(sound.id);
              }}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-all",
                "text-left text-sm",
                selectedSound === sound.id
                  ? "bg-orange-500/20 border-orange-500 text-orange-300"
                  : "bg-zinc-900/50 border-zinc-700 text-zinc-400 hover:border-zinc-600"
              )}
            >
              <span className="font-mono text-xs">{sound.name}</span>
              <div className="flex items-center gap-1">
                {playing === sound.id ? (
                  <div className="w-4 h-4 rounded-full bg-orange-500 animate-ping" />
                ) : selectedSound === sound.id ? (
                  <Check className="w-4 h-4 text-orange-400" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Test button */}
      <button
        onClick={() => previewSound(selectedSound)}
        className="w-full py-2 px-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-mono text-zinc-300 flex items-center justify-center gap-2"
      >
        <Play className="w-4 h-4" />
        Test Sound
      </button>
    </div>
  );
}

// Hook for managing alert sounds
export function useAlertSound() {
  const [alertSound, setAlertSound] = useState(() => {
    return localStorage.getItem('alertSound') || 'beep';
  });
  const [alertVolume, setAlertVolume] = useState(() => {
    const saved = localStorage.getItem('alertVolume');
    return saved ? parseFloat(saved) : 0.7;
  });
  const lastAlertRef = useRef(0);
  const alertCooldown = 3000; // 3 seconds between alerts

  // Persist settings
  useEffect(() => {
    localStorage.setItem('alertSound', alertSound);
  }, [alertSound]);

  useEffect(() => {
    localStorage.setItem('alertVolume', alertVolume.toString());
  }, [alertVolume]);

  const triggerAlert = (speedOverLimit = 0) => {
    const now = Date.now();
    if (now - lastAlertRef.current < alertCooldown) return;
    
    lastAlertRef.current = now;
    
    if (speedOverLimit > 5) {
      playEscalatingAlert(alertSound, speedOverLimit, 20, alertVolume);
    } else {
      playAlertSound(alertSound, alertVolume);
    }
  };

  return {
    alertSound,
    setAlertSound,
    alertVolume,
    setAlertVolume,
    triggerAlert
  };
}
