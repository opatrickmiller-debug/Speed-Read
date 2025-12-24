import { useEffect, useRef, useCallback } from "react";
import { AlertTriangle, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

// Voice alert messages in different languages
const VOICE_MESSAGES = {
  en: {
    speedAlert: "Speed alert. You are exceeding the speed limit.",
    severeAlert: (amount, unit) => `Warning! You are ${amount} ${unit === 'mph' ? 'miles per hour' : 'kilometers per hour'} over the limit. Slow down immediately.`,
    lang: "en-US"
  },
  es: {
    speedAlert: "Alerta de velocidad. Está excediendo el límite de velocidad.",
    severeAlert: (amount, unit) => `¡Advertencia! Está ${amount} ${unit === 'mph' ? 'millas por hora' : 'kilómetros por hora'} por encima del límite. Reduzca la velocidad inmediatamente.`,
    lang: "es-ES"
  },
  fr: {
    speedAlert: "Alerte de vitesse. Vous dépassez la limite de vitesse.",
    severeAlert: (amount, unit) => `Attention! Vous êtes à ${amount} ${unit === 'mph' ? 'miles par heure' : 'kilomètres par heure'} au-dessus de la limite. Ralentissez immédiatement.`,
    lang: "fr-FR"
  },
  de: {
    speedAlert: "Geschwindigkeitswarnung. Sie überschreiten das Tempolimit.",
    severeAlert: (amount, unit) => `Warnung! Sie fahren ${amount} ${unit === 'mph' ? 'Meilen pro Stunde' : 'Kilometer pro Stunde'} über dem Limit. Verlangsamen Sie sofort.`,
    lang: "de-DE"
  },
  it: {
    speedAlert: "Avviso di velocità. Stai superando il limite di velocità.",
    severeAlert: (amount, unit) => `Attenzione! Stai andando ${amount} ${unit === 'mph' ? 'miglia orarie' : 'chilometri orari'} oltre il limite. Rallenta immediatamente.`,
    lang: "it-IT"
  },
  pt: {
    speedAlert: "Alerta de velocidade. Você está excedendo o limite de velocidade.",
    severeAlert: (amount, unit) => `Aviso! Você está ${amount} ${unit === 'mph' ? 'milhas por hora' : 'quilômetros por hora'} acima do limite. Reduza a velocidade imediatamente.`,
    lang: "pt-BR"
  },
  zh: {
    speedAlert: "速度警报。您已超过限速。",
    severeAlert: (amount, unit) => `警告！您已超速${amount}${unit === 'mph' ? '英里每小时' : '公里每小时'}。请立即减速。`,
    lang: "zh-CN"
  },
  ja: {
    speedAlert: "速度警告。制限速度を超えています。",
    severeAlert: (amount, unit) => `警告！${amount}${unit === 'mph' ? 'マイル' : 'キロ'}オーバーです。直ちに減速してください。`,
    lang: "ja-JP"
  },
  ko: {
    speedAlert: "속도 경고. 제한 속도를 초과하고 있습니다.",
    severeAlert: (amount, unit) => `경고! ${amount}${unit === 'mph' ? '마일' : '킬로미터'} 초과입니다. 즉시 감속하세요.`,
    lang: "ko-KR"
  },
  hi: {
    speedAlert: "गति चेतावनी। आप गति सीमा से अधिक जा रहे हैं।",
    severeAlert: (amount, unit) => `चेतावनी! आप ${amount} ${unit === 'mph' ? 'मील प्रति घंटा' : 'किलोमीटर प्रति घंटा'} सीमा से ऊपर हैं। तुरंत धीमा करें।`,
    lang: "hi-IN"
  },
  ar: {
    speedAlert: "تنبيه السرعة. أنت تتجاوز الحد الأقصى للسرعة.",
    severeAlert: (amount, unit) => `تحذير! أنت تتجاوز الحد بـ ${amount} ${unit === 'mph' ? 'ميل في الساعة' : 'كيلومتر في الساعة'}. أبطئ فوراً.`,
    lang: "ar-SA"
  },
  ru: {
    speedAlert: "Предупреждение о скорости. Вы превышаете ограничение скорости.",
    severeAlert: (amount, unit) => `Внимание! Вы превышаете на ${amount} ${unit === 'mph' ? 'миль в час' : 'километров в час'}. Немедленно снизьте скорость.`,
    lang: "ru-RU"
  }
};

export const AlertOverlay = ({ 
  isActive, 
  audioEnabled, 
  voiceEnabled,
  voiceLanguage = "en",
  currentSpeed,
  speedLimit,
  speedUnit,
  onMuteClick,
  alertSound = "beep",
  alertVolume = 0.7,
  triggerAlert
}) => {
  const voiceSpokenRef = useRef(false);
  const lastVoiceTimeRef = useRef(0);
  const alertIntervalRef = useRef(null);
  
  // Get messages for selected language
  const messages = VOICE_MESSAGES[voiceLanguage] || VOICE_MESSAGES.en;

  // Voice announcement function
  const speakAlert = useCallback((message, lang) => {
    if (!('speechSynthesis' in window)) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = lang;
    
    // Try to find a voice for the selected language
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith(lang.split('-')[0]));
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
          ? messages.severeAlert(speedOver, speedUnit)
          : messages.speedAlert;
        
        speakAlert(message, messages.lang);
        voiceSpokenRef.current = true;
        lastVoiceTimeRef.current = now;
      }
    } else {
      voiceSpokenRef.current = false;
    }
  }, [isActive, voiceEnabled, currentSpeed, speedLimit, speedUnit, messages, speakAlert]);

  // Load voices on mount (needed for some browsers)
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Load voices
      window.speechSynthesis.getVoices();
      // Some browsers need this event
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
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
      
      audioRef.current = { oscillator, audioContext, interval, closed: false };
      
      return () => {
        clearInterval(interval);
        try {
          oscillator.stop();
          if (audioContext.state !== 'closed') {
            audioContext.close();
          }
        } catch (e) {
          // Ignore already closed context errors
        }
        if (audioRef.current) {
          audioRef.current.closed = true;
        }
      };
    } else if (audioRef.current && !audioRef.current.closed) {
      const { oscillator, audioContext, interval } = audioRef.current;
      clearInterval(interval);
      try {
        oscillator.stop();
        if (audioContext.state !== 'closed') {
          audioContext.close();
        }
      } catch (e) {
        // Ignore already closed context errors
      }
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

// Export available languages for settings panel
export const AVAILABLE_LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Português", flag: "🇧🇷" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
];
