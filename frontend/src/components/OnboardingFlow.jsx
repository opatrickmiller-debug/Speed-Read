import { useState, useEffect } from "react";
import { 
  ChevronRight, 
  MapPin, 
  Bell, 
  Gauge, 
  Shield,
  Check,
  Volume2,
  Navigation
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ONBOARDING_STEPS = [
  {
    id: "welcome",
    icon: Gauge,
    title: "Welcome to DriveCoach",
    description: "Your intelligent driving companion that helps you stay safe and avoid speeding tickets.",
    color: "text-sky-400",
    bgColor: "bg-sky-500/20"
  },
  {
    id: "location",
    icon: MapPin,
    title: "Location Access",
    description: "We need your location to track your speed and fetch local speed limits. Your data stays on your device.",
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    action: "grant_location"
  },
  {
    id: "alerts",
    icon: Bell,
    title: "Smart Alerts",
    description: "Get audio and voice alerts when you exceed speed limits. Customize alert timing and sounds in settings.",
    color: "text-orange-400",
    bgColor: "bg-orange-500/20"
  },
  {
    id: "safety",
    icon: Shield,
    title: "Drive Safely",
    description: "Mount your phone securely. Use voice alerts to keep your eyes on the road. Stay safe out there!",
    color: "text-purple-400",
    bgColor: "bg-purple-500/20"
  }
];

export function OnboardingFlow({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [locationGranted, setLocationGranted] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(true); // Default to true

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const Icon = step.icon;

  const requestLocation = async () => {
    setIsRequestingLocation(true);
    try {
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            setLocationGranted(true);
            resolve();
          },
          (error) => {
            console.log("Location denied:", error);
            resolve(); // Still continue even if denied
          },
          { timeout: 10000 }
        );
      });
    } catch (e) {
      console.log("Location error:", e);
    }
    setIsRequestingLocation(false);
    nextStep();
  };

  const nextStep = () => {
    if (isLastStep) {
      if (dontShowAgain) {
        localStorage.setItem('onboardingComplete', 'true');
      }
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (step.action === "grant_location" && !locationGranted) {
      requestLocation();
    } else {
      nextStep();
    }
  };

  const skipOnboarding = () => {
    if (dontShowAgain) {
      localStorage.setItem('onboardingComplete', 'true');
    }
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 pt-8 pb-4">
        {ONBOARDING_STEPS.map((_, idx) => (
          <div
            key={idx}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              idx === currentStep 
                ? "w-8 bg-sky-500" 
                : idx < currentStep 
                ? "bg-sky-500" 
                : "bg-zinc-700"
            )}
          />
        ))}
      </div>

      {/* Skip button */}
      <div className="absolute top-4 right-4">
        <button
          onClick={skipOnboarding}
          className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg text-sm font-mono transition-colors"
        >
          Skip →
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        {/* Icon */}
        <div className={cn(
          "w-24 h-24 rounded-full flex items-center justify-center mb-8",
          step.bgColor
        )}>
          <Icon className={cn("w-12 h-12", step.color)} />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-4">
          {step.title}
        </h1>

        {/* Description */}
        <p className="text-zinc-400 text-lg max-w-md leading-relaxed">
          {step.description}
        </p>

        {/* Location status */}
        {step.action === "grant_location" && locationGranted && (
          <div className="mt-6 flex items-center gap-2 text-green-400">
            <Check className="w-5 h-5" />
            <span>Location access granted!</span>
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div className="p-8 pb-12 space-y-4">
        {/* Don't show again checkbox */}
        <label className="flex items-center justify-center gap-3 cursor-pointer group">
          <div 
            className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
              dontShowAgain 
                ? "bg-sky-500 border-sky-500" 
                : "border-zinc-600 group-hover:border-zinc-400"
            )}
            onClick={() => setDontShowAgain(!dontShowAgain)}
          >
            {dontShowAgain && <Check className="w-3 h-3 text-white" />}
          </div>
          <span 
            className="text-zinc-400 text-sm font-mono"
            onClick={() => setDontShowAgain(!dontShowAgain)}
          >
            Don&apos;t show this again
          </span>
        </label>

        <Button
          onClick={handleNext}
          disabled={isRequestingLocation}
          className={cn(
            "w-full py-6 text-lg font-semibold rounded-xl",
            "bg-sky-600 hover:bg-sky-700 text-white",
            "transition-all duration-200"
          )}
        >
          {isRequestingLocation ? (
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Requesting...
            </span>
          ) : isLastStep ? (
            <span className="flex items-center gap-2">
              Get Started
              <Navigation className="w-5 h-5" />
            </span>
          ) : step.action === "grant_location" ? (
            <span className="flex items-center gap-2">
              {locationGranted ? "Continue" : "Enable Location"}
              <MapPin className="w-5 h-5" />
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Continue
              <ChevronRight className="w-5 h-5" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

// Hook to check if onboarding is needed
export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    // Check multiple flags - user might have cleared one
    const completed = localStorage.getItem('onboardingComplete');
    const hasUsedApp = localStorage.getItem('hasUsedApp');
    const hasVisitedApp = localStorage.getItem('hasVisitedApp');
    const authToken = localStorage.getItem('authToken');
    
    // If ANY of these exist, user has used app before - skip onboarding
    if (completed || hasUsedApp || hasVisitedApp || authToken) {
      return false;
    }
    return true;
  });
  const [isChecking, setIsChecking] = useState(false);

  const completeOnboarding = () => {
    localStorage.setItem('onboardingComplete', 'true');
    localStorage.setItem('hasUsedApp', 'true');
    setShowOnboarding(false);
  };

  return { showOnboarding, isChecking, completeOnboarding };
}
