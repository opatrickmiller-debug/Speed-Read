import { Settings, Volume2, VolumeX, Gauge, Mic, MicOff, Globe, Database, Trash2, Zap, Timer, CloudRain, Music, Smartphone, Signal, RotateCcw, Move, ChevronDown, ChevronUp, Sliders, Eye, Sun, Moon } from "lucide-react";
import React, { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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
import { MobileSettingsSection } from "@/components/MobileSettings";

// App version
const APP_VERSION = "2.2.0";

// Test messages for voice
const TEST_MESSAGES = {
  en: "Voice alerts are enabled.",
  es: "Las alertas de voz están activadas.",
  fr: "Les alertes vocales sont activées.",
  de: "Sprachbenachrichtigungen sind aktiviert.",
};

const LANG_CODES = {
  en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE", it: "it-IT", pt: "pt-BR",
  zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", hi: "hi-IN", ar: "ar-SA", ru: "ru-RU"
};

export const SettingsPanel = ({
  audioEnabled, setAudioEnabled,
  voiceEnabled, setVoiceEnabled,
  voiceLanguage, setVoiceLanguage,
  speedUnit, setSpeedUnit,
  thresholdOffset, setThresholdOffset,
  useDynamicThreshold, setUseDynamicThreshold,
  thresholdRanges, setThresholdRanges,
  demoMode, setDemoMode,
  offlineCacheEnabled, setOfflineCacheEnabled,
  currentSpeedLimit, currentThreshold,
  theme, setTheme,
  alertDelay, setAlertDelay,
  weatherAlertsEnabled, setWeatherAlertsEnabled,
  alertSound, setAlertSound,
  alertVolume, setAlertVolume,
  wakeLockEnabled, onWakeLockToggle, wakeLockActive,
  speedPredictionEnabled, setSpeedPredictionEnabled,
  dataSaverEnabled, setDataSaverEnabled,
  lowPowerMode, setLowPowerMode,
  speedometerOpacity, setSpeedometerOpacity,
}) => {
  const [cacheStats, setCacheStats] = useState(() => getCacheStats());
  const [showAdvanced, setShowAdvanced] = useState(() => {
    return localStorage.getItem('showAdvancedSettings') === 'true';
  });

  // Refresh cache stats
  React.useEffect(() => {
    const interval = setInterval(() => setCacheStats(getCacheStats()), 2000);
    return () => clearInterval(interval);
  }, []);

  // Save advanced toggle preference
  const toggleAdvanced = () => {
    const newValue = !showAdvanced;
    setShowAdvanced(newValue);
    localStorage.setItem('showAdvancedSettings', newValue.toString());
  };

  const testVoice = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(TEST_MESSAGES[voiceLanguage] || TEST_MESSAGES.en);
      utterance.lang = LANG_CODES[voiceLanguage] || "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleClearCache = () => {
    if (clearCache()) setCacheStats(getCacheStats());
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          data-testid="settings-trigger"
          className={cn(
            "backdrop-blur-xl bg-black/50 border border-white/10",
            "hover:bg-black/70 hover:border-white/20",
            "rounded-none w-12 h-12 flex items-center justify-center",
            "transition-colors duration-200"
          )}
        >
          <Settings className="w-5 h-5 text-white" />
        </button>
      </SheetTrigger>

      <SheetContent 
        side="right" 
        className="bg-zinc-600 border-l border-zinc-500 w-[320px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-white font-bold uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
          </SheetTitle>
          <SheetDescription className="text-white/80 text-xs">
            Configure your SpeedShield experience
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          
          {/* ============ BASIC SETTINGS ============ */}
          
          {/* Audio Alerts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {audioEnabled ? <Volume2 className="w-5 h-5 text-cyan-500" /> : <VolumeX className="w-5 h-5 text-white/80" />}
                <span className="text-sm font-medium text-white">Sound Alerts</span>
              </div>
              <Switch checked={audioEnabled} onCheckedChange={setAudioEnabled} />
            </div>
            
            {audioEnabled && (
              <div className="pl-8 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white">Volume</span>
                  <span className="text-cyan-400">{Math.round(alertVolume * 100)}%</span>
                </div>
                <Slider
                  value={[alertVolume]}
                  onValueChange={([v]) => setAlertVolume(v)}
                  min={0} max={1} step={0.1}
                />
              </div>
            )}
          </div>

          {/* Voice Alerts */}
          <div className="space-y-3 pt-3 border-t border-zinc-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {voiceEnabled ? <Mic className="w-5 h-5 text-green-500" /> : <MicOff className="w-5 h-5 text-white/80" />}
                <span className="text-sm font-medium text-white">Voice Alerts</span>
              </div>
              <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
            </div>
            
            {voiceEnabled && (
              <div className="pl-8 space-y-2">
                <Select value={voiceLanguage} onValueChange={setVoiceLanguage}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-600 text-white h-9">
                    <Globe className="w-4 h-4 mr-2 text-white" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-600">
                    {AVAILABLE_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code} className="text-white">
                        {lang.flag} {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button onClick={testVoice} className="text-xs text-cyan-500 hover:text-cyan-400">
                  Test voice
                </button>
              </div>
            )}
          </div>

          {/* Speed Unit */}
          <div className="space-y-2 pt-3 border-t border-zinc-700">
            <div className="flex items-center gap-3">
              <Gauge className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-medium text-white">Speed Unit</span>
            </div>
            <div className="pl-8 flex gap-2">
              {['mph', 'km/h'].map(unit => (
                <button
                  key={unit}
                  onClick={() => { setSpeedUnit(unit); localStorage.setItem('speedUnit', unit); }}
                  className={cn(
                    "px-4 py-2 text-xs font-mono uppercase rounded transition-colors",
                    speedUnit === unit
                      ? "bg-orange-500/20 border border-orange-500/50 text-orange-400"
                      : "bg-zinc-700/50 border border-zinc-600 text-white hover:border-zinc-500"
                  )}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>

          {/* Alert Delay */}
          <div className="space-y-3 pt-3 border-t border-zinc-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Timer className="w-5 h-5 text-yellow-500" />
                <span className="text-sm font-medium text-white">Alert Delay</span>
              </div>
              <span className="text-yellow-400 text-sm font-mono">{alertDelay}s</span>
            </div>
            <div className="pl-8">
              <Slider
                value={[alertDelay]}
                onValueChange={([v]) => { setAlertDelay(v); localStorage.setItem('alertDelay', v.toString()); }}
                min={0} max={10} step={1}
              />
              <p className="text-xs text-white/80 mt-1">Wait before alerting</p>
            </div>
          </div>

          {/* Keep Screen On */}
          <div className="space-y-2 pt-3 border-t border-zinc-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className={cn("w-5 h-5", wakeLockActive ? "text-cyan-500" : "text-white/80")} />
                <span className="text-sm font-medium text-white">Keep Screen On</span>
              </div>
              <Switch checked={wakeLockEnabled} onCheckedChange={onWakeLockToggle} />
            </div>
            {wakeLockActive && (
              <p className="text-xs text-green-400 pl-8">✓ Screen will stay on while driving</p>
            )}
          </div>

          {/* ============ ADVANCED SETTINGS TOGGLE ============ */}
          
          <button
            onClick={toggleAdvanced}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 rounded-lg",
              "bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600",
              "transition-colors"
            )}
          >
            <div className="flex items-center gap-3">
              <Sliders className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-medium text-white">Advanced Settings</span>
            </div>
            {showAdvanced ? (
              <ChevronUp className="w-5 h-5 text-white" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white" />
            )}
          </button>

          {/* ============ ADVANCED SETTINGS (COLLAPSIBLE) ============ */}
          
          {showAdvanced && (
            <div className="space-y-6 pl-2 border-l-2 border-purple-500/50">
              
              {/* Display Options */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-purple-400 text-xs font-mono uppercase">
                  <Eye className="w-4 h-4" />
                  Display
                </div>
                
                {/* Opacity */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white">Transparency</span>
                    <span className="text-cyan-400">{Math.round((1 - speedometerOpacity) * 100)}%</span>
                  </div>
                  <Slider
                    value={[speedometerOpacity]}
                    onValueChange={([v]) => setSpeedometerOpacity(v)}
                    min={0.2} max={1} step={0.05}
                  />
                </div>

                {/* Reset Position */}
                <button
                  onClick={() => {
                    localStorage.removeItem('speedHudPosition');
                    localStorage.removeItem('speedHudPosition_locked');
                    window.location.reload();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono bg-zinc-700/50 border border-zinc-600 text-white hover:text-purple-400 hover:border-purple-500/50 rounded transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Position
                </button>
              </div>

              {/* Alert Threshold */}
              <div className="space-y-3 pt-3 border-t border-zinc-700/50">
                <div className="flex items-center gap-2 text-purple-400 text-xs font-mono uppercase">
                  <Zap className="w-4 h-4" />
                  Alert Threshold
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white">Smart Threshold</span>
                  <Switch checked={useDynamicThreshold} onCheckedChange={setUseDynamicThreshold} />
                </div>
                
                {!useDynamicThreshold && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-white">Buffer</span>
                      <span className="text-cyan-400">+{thresholdOffset} {speedUnit}</span>
                    </div>
                    <Slider
                      value={[thresholdOffset]}
                      onValueChange={([v]) => setThresholdOffset(v)}
                      min={0} max={15} step={1}
                    />
                  </div>
                )}
                
                {currentSpeedLimit && (
                  <p className="text-xs text-white/80">
                    Alert at: {currentSpeedLimit + currentThreshold} {speedUnit}
                  </p>
                )}
              </div>

              {/* Sound Customization */}
              <div className="space-y-3 pt-3 border-t border-zinc-700/50">
                <div className="flex items-center gap-2 text-purple-400 text-xs font-mono uppercase">
                  <Music className="w-4 h-4" />
                  Alert Sound
                </div>
                <SoundSelector
                  selectedSound={alertSound}
                  onSelect={setAlertSound}
                  volume={alertVolume}
                  onVolumeChange={setAlertVolume}
                />
              </div>

              {/* AI Prediction */}
              <div className="space-y-2 pt-3 border-t border-zinc-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs text-white">AI Speed Prediction</span>
                  </div>
                  <Switch checked={speedPredictionEnabled} onCheckedChange={setSpeedPredictionEnabled} />
                </div>
                <p className="text-xs text-white/80">Warns before entering lower speed zones</p>
              </div>

              {/* Weather Alerts */}
              <div className="space-y-2 pt-3 border-t border-zinc-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CloudRain className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-white">Weather Alerts</span>
                  </div>
                  <Switch checked={weatherAlertsEnabled} onCheckedChange={setWeatherAlertsEnabled} />
                </div>
              </div>

              {/* Mobile Optimization */}
              <div className="space-y-3 pt-3 border-t border-zinc-700/50">
                <div className="flex items-center gap-2 text-purple-400 text-xs font-mono uppercase">
                  <Signal className="w-4 h-4" />
                  Mobile
                </div>
                <MobileSettingsSection
                  dataSaverEnabled={dataSaverEnabled}
                  setDataSaverEnabled={setDataSaverEnabled}
                  lowPowerMode={lowPowerMode}
                  setLowPowerMode={setLowPowerMode}
                />
              </div>

              {/* Offline Cache */}
              <div className="space-y-3 pt-3 border-t border-zinc-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-white">Offline Cache</span>
                  </div>
                  <Switch checked={offlineCacheEnabled} onCheckedChange={setOfflineCacheEnabled} />
                </div>
                
                {offlineCacheEnabled && (
                  <div className="space-y-2">
                    <div className="text-xs space-y-1 bg-zinc-800/50 p-2 rounded">
                      <div className="flex justify-between">
                        <span className="text-white/80">Cached:</span>
                        <span className="text-white">{cacheStats.validEntries} / {cacheStats.maxEntries || 500}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-green-400/70">Auto-managed</span>
                      </div>
                    </div>
                    
                    {/* Clear Cache Button */}
                    <button
                      onClick={() => {
                        clearCache();
                        setCacheStats(getCacheStats());
                        alert('Cache cleared!');
                      }}
                      disabled={cacheStats.validEntries === 0}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono rounded transition-colors",
                        cacheStats.validEntries > 0
                          ? "bg-zinc-700/50 border border-zinc-600 text-white hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400"
                          : "bg-zinc-700/30 border border-zinc-700 text-white/80 cursor-not-allowed"
                      )}
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear Cache
                    </button>
                  </div>
                )}
              </div>

              {/* App Updates */}
              <div className="space-y-3 pt-3 border-t border-zinc-700/50">
                <div className="flex items-center gap-2 text-purple-400 text-xs font-mono uppercase">
                  <RotateCcw className="w-4 h-4" />
                  App Updates
                </div>
                <button
                  onClick={() => {
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(registrations => {
                        registrations.forEach(reg => {
                          reg.update();
                          if (reg.waiting) {
                            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                          }
                        });
                      });
                      // Clear caches and reload
                      if ('caches' in window) {
                        caches.keys().then(names => {
                          Promise.all(names.map(name => caches.delete(name))).then(() => {
                            window.location.reload(true);
                          });
                        });
                      } else {
                        window.location.reload(true);
                      }
                    } else {
                      window.location.reload(true);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/100/20 rounded transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Check for Updates
                </button>
                <p className="text-xs text-white/80">Force refresh to get latest version</p>
              </div>

              {/* Theme */}
              <div className="space-y-3 pt-3 border-t border-zinc-700/50">
                <div className="flex items-center gap-2 text-purple-400 text-xs font-mono uppercase">
                  {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  Theme
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTheme('dark')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono rounded transition-colors",
                      theme === 'dark'
                        ? "bg-purple-500/20 border border-purple-500/50 text-purple-400"
                        : "bg-zinc-700/50 border border-zinc-600 text-white hover:border-zinc-500"
                    )}
                  >
                    <Moon className="w-3 h-3" />
                    Dark
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono rounded transition-colors",
                      theme === 'light'
                        ? "bg-yellow-500/20 border border-yellow-500/50 text-yellow-400"
                        : "bg-zinc-700/50 border border-zinc-600 text-white hover:border-zinc-500"
                    )}
                  >
                    <Sun className="w-3 h-3" />
                    Light
                  </button>
                </div>
              </div>

              {/* Demo Mode */}
              <div className="space-y-2 pt-3 border-t border-zinc-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white">Demo Mode</span>
                  <Switch checked={demoMode} onCheckedChange={setDemoMode} />
                </div>
              </div>

              {/* Clear All Data */}
              <button
                onClick={() => {
                  if (confirm('Clear all app data?')) {
                    localStorage.clear();
                    if ('caches' in window) caches.keys().then(names => names.forEach(n => caches.delete(n)));
                    window.location.href = window.location.origin + '/?cleared=' + Date.now();
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/200/20 rounded transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear All App Data
              </button>
            </div>
          )}

          {/* Version */}
          <p className="text-xs text-white/80 text-center pt-4 border-t border-zinc-700">
            SpeedShield v{APP_VERSION}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
