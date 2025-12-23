import { Settings, Volume2, VolumeX, Gauge, Navigation, Mic, MicOff } from "lucide-react";
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
import { cn } from "@/lib/utils";

export const SettingsPanel = ({
  audioEnabled,
  setAudioEnabled,
  voiceEnabled,
  setVoiceEnabled,
  speedUnit,
  setSpeedUnit,
  thresholdOffset,
  setThresholdOffset,
  demoMode,
  setDemoMode,
}) => {
  // Test voice function
  const testVoice = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance("Voice alerts are enabled. You will hear warnings when exceeding the speed limit.");
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
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
        className="backdrop-blur-xl bg-zinc-950/95 border-l border-white/10 w-[320px]"
      >
        <SheetHeader>
          <SheetTitle className="text-white font-chivo font-black uppercase tracking-wider">
            Control Panel
          </SheetTitle>
          <SheetDescription className="text-zinc-500 font-mono text-xs">
            Configure your speed alert preferences
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-8 space-y-6">
          {/* Audio Alert Toggle */}
          <div className="space-y-3">
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
          </div>

          {/* Voice Alert Toggle */}
          <div className="space-y-3">
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
            {voiceEnabled && (
              <button
                data-testid="test-voice-btn"
                onClick={testVoice}
                className="ml-8 px-3 py-1 text-xs font-mono uppercase tracking-wider bg-green-500/20 border border-green-500/50 text-green-400 hover:bg-green-500/30 transition-colors"
              >
                Test Voice
              </button>
            )}
          </div>
          
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
          
          {/* Threshold Offset Slider */}
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div className="flex items-center gap-3">
              <Navigation className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider">
                Alert Threshold
              </span>
            </div>
            <div className="pl-8 space-y-3">
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
                Alert triggers when exceeding limit by this amount
              </p>
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
        </div>
      </SheetContent>
    </Sheet>
  );
};
