import { Settings, Volume2, VolumeX, Gauge, Navigation, Mic, MicOff, Globe, Database, Trash2, Zap, Sun, Moon, Timer, CloudRain, Music, Smartphone, AlertTriangle } from "lucide-react";
import React, { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AVAILABLE_LANGUAGES } from "@/components/AlertOverlay";
import { getCacheStats, clearCache } from "@/utils/speedLimitCache";
import { SoundSelector } from "@/components/SoundCustomization";

// Test messages for each language
const TEST_MESSAGES = {
  en: "Voice alerts are enabled. You will hear warnings when exceeding the speed limit.",
  es: "Las alertas de voz están activadas. Escuchará advertencias cuando exceda el límite de velocidad.",
  fr: "Les alertes vocales sont activées. Vous entendrez des avertissements en cas de dépassement de la limite de vitesse.",
  de: "Sprachbenachrichtigungen sind aktiviert. Sie werden Warnungen hören, wenn Sie das Tempolimit überschreiten.",
  it: "Gli avvisi vocali sono attivati. Sentirai avvertimenti quando superi il limite di velocità.",
  pt: "Os alertas de voz estão ativados. Você ouvirá avisos quando exceder o limite de velocidade.",
  zh: "语音警报已启用。超速时您将听到警告。",
  ja: "音声アラートが有効です。制限速度を超えると警告が聞こえます。",
  ko: "음성 알림이 활성화되었습니다. 제한 속도를 초과하면 경고가 들립니다.",
  hi: "वॉयस अलर्ट सक्षम हैं। गति सीमा से अधिक होने पर आपको चेतावनी सुनाई देगी।",
  ar: "تنبيهات الصوت مفعلة. ستسمع تحذيرات عند تجاوز الحد الأقصى للسرعة.",
  ru: "Голосовые оповещения включены. Вы услышите предупреждения при превышении скорости.",
};

const LANG_CODES = {
  en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE", it: "it-IT", pt: "pt-BR",
  zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", hi: "hi-IN", ar: "ar-SA", ru: "ru-RU"
};

export const SettingsPanel = ({
  audioEnabled,
  setAudioEnabled,
  voiceEnabled,
  setVoiceEnabled,
  voiceLanguage,
  setVoiceLanguage,
  speedUnit,
  setSpeedUnit,
  thresholdOffset,
  setThresholdOffset,
  useDynamicThreshold,
  setUseDynamicThreshold,
  thresholdRanges,
  setThresholdRanges,
  demoMode,
  setDemoMode,
  offlineCacheEnabled,
  setOfflineCacheEnabled,
  currentSpeedLimit,
  currentThreshold,
  theme,
  setTheme,
  alertDelay,
  setAlertDelay,
  weatherAlertsEnabled,
  setWeatherAlertsEnabled,
  alertSound,
  setAlertSound,
  alertVolume,
  setAlertVolume,
  wakeLockEnabled,
  onWakeLockToggle,
  wakeLockActive,
  speedPredictionEnabled,
  setSpeedPredictionEnabled,
}) => {
  const [cacheStats, setCacheStats] = useState(() => getCacheStats());
  
  // Refresh cache stats every 2 seconds when panel is open
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCacheStats(getCacheStats());
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  
  // Test voice function with selected language
  const testVoice = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const message = TEST_MESSAGES[voiceLanguage] || TEST_MESSAGES.en;
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = LANG_CODES[voiceLanguage] || "en-US";
      utterance.rate = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      const langPrefix = voiceLanguage;
      const preferredVoice = voices.find(v => v.lang.startsWith(langPrefix));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  };
  
  // Clear cache handler
  const handleClearCache = () => {
    if (clearCache()) {
      setCacheStats(getCacheStats());
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          data-testid="settings-trigger"
          variant="ghost"
          size="icon"
          className={cn(
            "backdrop-blur-xl bg-black/50 border border-white/10",
            "hover:bg-black/70 hover:border-white/20",
            "rounded-none w-12 h-12",
            "transition-colors duration-200"
          )}
        >
          <Settings className="w-5 h-5 text-zinc-300" />
        </Button>
      </SheetTrigger>
      
      <SheetContent 
        side="right" 
        className="backdrop-blur-xl bg-zinc-950/95 border-l border-white/10 w-[340px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-white font-chivo font-black uppercase tracking-wider">
            Control Panel
          </SheetTitle>
          <SheetDescription className="text-zinc-500 font-mono text-xs">
            Configure your speed alert preferences
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-5">
          {/* Theme Toggle - AT TOP */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon className="w-5 h-5 text-indigo-400" />
              ) : (
                <Sun className="w-5 h-5 text-yellow-500" />
              )}
              <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider">
                Theme
              </span>
            </div>
            <div className="flex gap-2 pl-8">
              <button
                data-testid="theme-light"
                onClick={() => setTheme("light")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-mono",
                  "border transition-colors duration-200 rounded",
                  theme === "light"
                    ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                    : "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500"
                )}
              >
                <Sun className="w-4 h-4" />
                Light
              </button>
              <button
                data-testid="theme-dark"
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-mono",
                  "border transition-colors duration-200 rounded",
                  theme === "dark"
                    ? "bg-indigo-500/20 border-indigo-500 text-indigo-400"
                    : "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500"
                )}
              >
                <Moon className="w-4 h-4" />
                Dark
              </button>
            </div>
          </div>

          {/* Keep Screen On (Wake Lock) */}
          <div className="space-y-2 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className={cn(
                  "w-5 h-5",
                  wakeLockActive ? "text-cyan-500" : "text-zinc-500"
                )} />
                <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider">
                  Keep Screen On
                </span>
              </div>
              <Switch
                data-testid="wakelock-toggle"
                checked={wakeLockEnabled}
                onCheckedChange={onWakeLockToggle}
                className="data-[state=checked]:bg-cyan-500"
              />
            </div>
            <p className="text-xs text-zinc-500 font-mono pl-8">
              Prevents phone from sleeping while driving
            </p>
            {wakeLockActive && (
              <p className="text-xs text-cyan-400 font-mono pl-8">
                ✓ Screen wake lock is active
              </p>
            )}
          </div>

          {/* Weather Alerts Toggle */}
          <div className="space-y-2 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CloudRain className={cn(
                  "w-5 h-5",
                  weatherAlertsEnabled ? "text-sky-500" : "text-zinc-500"
                )} />
                <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider">
                  Weather Alerts
                </span>
              </div>
              <Switch
                data-testid="weather-toggle"
                checked={weatherAlertsEnabled}
                onCheckedChange={setWeatherAlertsEnabled}
                className="data-[state=checked]:bg-sky-500"
              />
            </div>
            <p className="text-xs text-zinc-500 font-mono pl-8">
              Show driving condition alerts from Weather.gov (US only)
            </p>
          </div>

          {/* Speed Prediction (AI Look-Ahead) */}
          <div className="space-y-2 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className={cn(
                  "w-5 h-5",
                  speedPredictionEnabled ? "text-amber-500" : "text-zinc-500"
                )} />
                <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider">
                  Speed Prediction
                </span>
              </div>
              <Switch
                data-testid="prediction-toggle"
                checked={speedPredictionEnabled}
                onCheckedChange={setSpeedPredictionEnabled}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
            <p className="text-xs text-zinc-500 font-mono pl-8">
              AI warns you before entering lower speed zones
            </p>
          </div>

          {/* Audio Alert Toggle */}
          <div className="space-y-2 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {audioEnabled ? (
                  <Volume2 className="w-5 h-5 text-orange-500" />
                ) : (
                  <VolumeX className="w-5 h-5 text-zinc-500" />
                )}
                <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider">
                  Audio Alarm
                </span>
              </div>
              <Switch
                data-testid="audio-toggle"
                checked={audioEnabled}
                onCheckedChange={setAudioEnabled}
                className="data-[state=checked]:bg-orange-500"
              />
            </div>
            <p className="text-xs text-zinc-500 font-mono pl-8">
              Plays beeping alarm sound when speeding
            </p>
            
            {/* Sound Customization */}
            {audioEnabled && (
              <div className="pl-8 pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <Music className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-medium text-zinc-300 font-mono uppercase tracking-wider">
                    Customize Sound
                  </span>
                </div>
                <SoundSelector
                  selectedSound={alertSound}
                  onSelect={setAlertSound}
                  volume={alertVolume}
                  onVolumeChange={setAlertVolume}
                />
              </div>
            )}
          </div>

          {/* Voice Alert Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {voiceEnabled ? (
                  <Mic className="w-5 h-5 text-green-500" />
                ) : (
                  <MicOff className="w-5 h-5 text-zinc-500" />
                )}
                <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider">
                  Voice Alerts
                </span>
              </div>
              <Switch
                data-testid="voice-toggle"
                checked={voiceEnabled}
                onCheckedChange={setVoiceEnabled}
                className="data-[state=checked]:bg-green-500"
              />
            </div>
            <p className="text-xs text-zinc-500 font-mono pl-8">
              Speaks warnings when exceeding speed limit
            </p>
          </div>

          {/* Language Selector */}
          {voiceEnabled && (
            <div className="space-y-3 pl-8">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-medium text-zinc-300 font-mono uppercase tracking-wider">
                  Voice Language
                </span>
              </div>
              <Select value={voiceLanguage} onValueChange={setVoiceLanguage}>
                <SelectTrigger 
                  data-testid="language-select"
                  className="w-full bg-zinc-900 border-zinc-700 text-zinc-200"
                >
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {AVAILABLE_LANGUAGES.map((lang) => (
                    <SelectItem 
                      key={lang.code} 
                      value={lang.code}
                      className="text-zinc-200 focus:bg-zinc-800 focus:text-white"
                    >
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <button
                data-testid="test-voice-btn"
                onClick={testVoice}
                className="w-full px-3 py-2 text-xs font-mono uppercase tracking-wider bg-green-500/20 border border-green-500/50 text-green-400 hover:bg-green-500/30 transition-colors"
              >
                Test Voice
              </button>
            </div>
          )}
          
          {/* Speed Unit Toggle */}
          <div className="space-y-3 pt-4 border-t border-zinc-800">
            <div className="flex items-center gap-3">
              <Gauge className="w-5 h-5 text-sky-400" />
              <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider">
                Speed Unit
              </span>
            </div>
            <div className="flex gap-2 pl-8">
              <button
                data-testid="unit-mph"
                onClick={() => setSpeedUnit("mph")}
                className={cn(
                  "px-4 py-2 text-sm font-mono uppercase tracking-wider",
                  "border transition-colors duration-200",
                  speedUnit === "mph"
                    ? "bg-sky-500/20 border-sky-500 text-sky-400"
                    : "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500"
                )}
              >
                MPH
              </button>
              <button
                data-testid="unit-kmh"
                onClick={() => setSpeedUnit("km/h")}
                className={cn(
                  "px-4 py-2 text-sm font-mono uppercase tracking-wider",
                  "border transition-colors duration-200",
                  speedUnit === "km/h"
                    ? "bg-sky-500/20 border-sky-500 text-sky-400"
                    : "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500"
                )}
              >
                KM/H
              </button>
            </div>
          </div>
          
          {/* Alert Delay Timer */}
          <div className="space-y-3 pt-4 border-t border-zinc-800">
            <div className="flex items-center gap-3">
              <Timer className="w-5 h-5 text-purple-500" />
              <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider">
                Alert Delay
              </span>
            </div>
            <div className="pl-8 space-y-3">
              <div className="flex justify-between text-xs text-zinc-500 font-mono">
                <span>Trigger after</span>
                <span data-testid="delay-value" className="text-purple-400">
                  {alertDelay === 0 ? "Instant" : `${alertDelay} sec`}
                </span>
              </div>
              <Slider
                data-testid="delay-slider"
                value={[alertDelay]}
                onValueChange={(value) => setAlertDelay(value[0])}
                max={10}
                min={0}
                step={1}
                className="[&_[role=slider]]:bg-purple-500 [&_[role=slider]]:border-purple-400"
              />
              <p className="text-xs text-zinc-500 font-mono">
                Wait this long over speed limit before alerting
              </p>
            </div>
          </div>
          
          {/* Threshold Settings */}
          <div className="space-y-3 pt-4 border-t border-zinc-800">
            <div className="flex items-center gap-3">
              <Navigation className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider">
                Alert Threshold
              </span>
            </div>
            
            {/* Dynamic Threshold Toggle */}
            <div className="pl-8 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className={cn("w-4 h-4", useDynamicThreshold ? "text-yellow-400" : "text-zinc-500")} />
                  <span className="text-xs font-mono text-zinc-300">Smart Thresholds</span>
                </div>
                <Switch
                  data-testid="dynamic-threshold-toggle"
                  checked={useDynamicThreshold}
                  onCheckedChange={setUseDynamicThreshold}
                  className="data-[state=checked]:bg-yellow-500"
                />
              </div>
              
              {useDynamicThreshold ? (
                <>
                  <p className="text-xs text-zinc-500 font-mono">
                    Customize speed zones and tolerances
                  </p>
                  
                  {/* Dynamic Threshold Ranges - Fully Editable */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded p-3 space-y-3">
                    {thresholdRanges.map((range, idx) => (
                      <div key={idx} className="space-y-2">
                        {/* Zone Label */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-500 font-mono">Zone {idx + 1}</span>
                          <span className={cn(
                            "text-xs font-mono px-2 py-0.5 rounded",
                            range.offset === 0 ? "bg-red-500/20 text-red-400" : 
                            range.offset <= 5 ? "bg-yellow-500/20 text-yellow-400" : 
                            "bg-green-500/20 text-green-400"
                          )}>
                            +{range.offset} {speedUnit} tolerance
                          </span>
                        </div>
                        
                        {/* Speed Range Inputs */}
                        <div className="flex items-center gap-2 text-xs font-mono">
                          {/* Min Limit */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                const newRanges = [...thresholdRanges];
                                const newMin = Math.max(0, range.minLimit - 5);
                                // Don't go below previous range's max
                                if (idx > 0 && newMin < newRanges[idx - 1].maxLimit) return;
                                newRanges[idx].minLimit = newMin;
                                setThresholdRanges(newRanges);
                              }}
                              disabled={idx === 0}
                              className="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-sky-400">
                              {range.minLimit}
                            </span>
                            <button
                              onClick={() => {
                                const newRanges = [...thresholdRanges];
                                const newMin = range.minLimit + 5;
                                // Don't exceed this range's max
                                if (newMin >= range.maxLimit) return;
                                newRanges[idx].minLimit = newMin;
                                // Also update previous range's max
                                if (idx > 0) {
                                  newRanges[idx - 1].maxLimit = newMin;
                                }
                                setThresholdRanges(newRanges);
                              }}
                              disabled={idx === 0}
                              className="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                            >
                              +
                            </button>
                          </div>
                          
                          <span className="text-zinc-600">to</span>
                          
                          {/* Max Limit */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                if (idx === thresholdRanges.length - 1) return; // Can't change last range's max
                                const newRanges = [...thresholdRanges];
                                const newMax = Math.max(range.minLimit + 5, range.maxLimit - 5);
                                newRanges[idx].maxLimit = newMax;
                                // Update next range's min
                                if (idx < thresholdRanges.length - 1) {
                                  newRanges[idx + 1].minLimit = newMax;
                                }
                                setThresholdRanges(newRanges);
                              }}
                              disabled={idx === thresholdRanges.length - 1}
                              className="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-sky-400">
                              {range.maxLimit === 999 ? '∞' : range.maxLimit}
                            </span>
                            <button
                              onClick={() => {
                                if (idx === thresholdRanges.length - 1) return; // Can't change last range's max
                                const newRanges = [...thresholdRanges];
                                const newMax = range.maxLimit + 5;
                                newRanges[idx].maxLimit = newMax;
                                // Update next range's min
                                if (idx < thresholdRanges.length - 1) {
                                  newRanges[idx + 1].minLimit = newMax;
                                }
                                setThresholdRanges(newRanges);
                              }}
                              disabled={idx === thresholdRanges.length - 1}
                              className="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                            >
                              +
                            </button>
                          </div>
                          
                          <span className="text-zinc-600 ml-1">{speedUnit}</span>
                          
                          {/* Offset Controls */}
                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              onClick={() => {
                                const newRanges = [...thresholdRanges];
                                newRanges[idx].offset = Math.max(0, newRanges[idx].offset - 1);
                                setThresholdRanges(newRanges);
                              }}
                              className="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 text-xs"
                            >
                              -
                            </button>
                            <span className={cn(
                              "w-6 text-center",
                              range.offset === 0 ? "text-red-400" : range.offset <= 5 ? "text-yellow-400" : "text-green-400"
                            )}>
                              +{range.offset}
                            </span>
                            <button
                              onClick={() => {
                                const newRanges = [...thresholdRanges];
                                newRanges[idx].offset = Math.min(20, newRanges[idx].offset + 1);
                                setThresholdRanges(newRanges);
                              }}
                              className="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 text-xs"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Reset to Defaults */}
                  <button
                    onClick={() => {
                      setThresholdRanges([
                        { minLimit: 0, maxLimit: 50, offset: 0 },
                        { minLimit: 50, maxLimit: 65, offset: 5 },
                        { minLimit: 65, maxLimit: 999, offset: 10 },
                      ]);
                    }}
                    className="w-full text-xs font-mono text-zinc-500 hover:text-zinc-300 py-1"
                  >
                    Reset to defaults
                  </button>
                  
                  {/* Current Status */}
                  {currentSpeedLimit && (
                    <div className="bg-sky-500/10 border border-sky-500/30 rounded p-2">
                      <p className="text-xs text-sky-300 font-mono text-center">
                        Current: {currentSpeedLimit} {speedUnit} zone → Alert at +{currentThreshold} {speedUnit}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between text-xs text-zinc-500 font-mono">
                    <span>At Limit</span>
                    <span data-testid="threshold-value" className="text-orange-400">
                      +{thresholdOffset} {speedUnit}
                    </span>
                  </div>
                  <Slider
                    data-testid="threshold-slider"
                    value={[thresholdOffset]}
                    onValueChange={(value) => setThresholdOffset(value[0])}
                    max={15}
                    min={0}
                    step={1}
                    className="[&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-400"
                  />
                  <p className="text-xs text-zinc-500 font-mono">
                    Fixed threshold for all speed zones
                  </p>
                </>
              )}
            </div>
          </div>
          
          {/* Demo Mode Toggle */}
          <div className="space-y-3 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center">
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    demoMode ? "bg-green-500 animate-pulse" : "bg-zinc-600"
                  )} />
                </div>
                <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider">
                  Demo Mode
                </span>
              </div>
              <Switch
                data-testid="demo-toggle"
                checked={demoMode}
                onCheckedChange={setDemoMode}
                className="data-[state=checked]:bg-green-500"
              />
            </div>
            <p className="text-xs text-zinc-500 font-mono pl-8">
              Simulates driving for testing without GPS
            </p>
          </div>
          
          {/* Offline Cache Section */}
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className={cn(
                  "w-5 h-5",
                  offlineCacheEnabled ? "text-yellow-500" : "text-zinc-500"
                )} />
                <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider">
                  Offline Cache
                </span>
              </div>
              <Switch
                data-testid="cache-toggle"
                checked={offlineCacheEnabled}
                onCheckedChange={setOfflineCacheEnabled}
                className="data-[state=checked]:bg-yellow-500"
              />
            </div>
            <p className="text-xs text-zinc-500 font-mono pl-8">
              Cache speed limits for offline use
            </p>
            
            {offlineCacheEnabled && (
              <div className="pl-8 space-y-3">
                {/* Cache stats */}
                <div className="bg-zinc-900/50 border border-zinc-800 p-3 rounded space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-500">Cached locations:</span>
                    <span data-testid="cache-count" className="text-yellow-400">{cacheStats.validEntries}</span>
                  </div>
                  {cacheStats.validEntries > 0 && (
                    <>
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-zinc-500">Oldest entry:</span>
                        <span className="text-zinc-400">{cacheStats.oldestEntry} days ago</span>
                      </div>
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-zinc-500">Newest entry:</span>
                        <span className="text-zinc-400">{cacheStats.newestEntry} min ago</span>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Clear cache button */}
                <button
                  data-testid="clear-cache-btn"
                  onClick={handleClearCache}
                  disabled={cacheStats.validEntries === 0}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 px-3 py-2",
                    "text-xs font-mono uppercase tracking-wider",
                    "border transition-colors",
                    cacheStats.validEntries > 0
                      ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                      : "bg-zinc-800/50 border-zinc-700 text-zinc-600 cursor-not-allowed"
                  )}
                >
                  <Trash2 className="w-3 h-3" />
                  Clear Cache
                </button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
