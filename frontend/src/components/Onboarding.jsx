import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authApi } from '../lib/api';
import { cn } from '../lib/utils';
import { 
  ChevronRight, 
  ChevronLeft,
  Target,
  Dna,
  Droplets,
  Sparkles,
  Check,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const steps = [
  {
    id: 'welcome',
    title: 'Welcome to Isotope',
    subtitle: 'Your Keto Nutrition Tracker',
    icon: Sparkles,
    color: 'emerald'
  },
  {
    id: 'protein',
    title: 'Set Your Protein Goal',
    subtitle: 'How much protein do you want daily?',
    icon: Target,
    color: 'violet'
  },
  {
    id: 'carbs',
    title: 'Choose Your Keto Level',
    subtitle: 'Set your daily carb limit',
    icon: Target,
    color: 'cyan'
  },
  {
    id: 'learn',
    title: 'Beyond Basic Tracking',
    subtitle: 'Discover what makes Isotope special',
    icon: Dna,
    color: 'pink'
  }
];

const ketoLevels = [
  { value: 20, label: 'Strict Keto', desc: 'Maximum fat burning', color: 'emerald' },
  { value: 35, label: 'Moderate Keto', desc: 'Balanced approach', color: 'cyan' },
  { value: 50, label: 'Liberal Keto', desc: 'More flexibility', color: 'amber' }
];

export const Onboarding = ({ onComplete }) => {
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [proteinGoal, setProteinGoal] = useState(user?.protein_goal || 150);
  const [carbLimit, setCarbLimit] = useState(user?.daily_carb_limit || 20);
  const [saving, setSaving] = useState(false);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const res = await authApi.updateSettings({
        protein_goal: proteinGoal,
        daily_carb_limit: carbLimit,
        onboarding_completed: true
      });
      updateUser({ ...res.data, onboarding_completed: true });
      localStorage.setItem('onboarding_completed', 'true');
      toast.success('Setup complete! Let\'s start tracking.');
      onComplete();
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const step = steps[currentStep];
  const StepIcon = step.icon;

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex items-center justify-center p-4",
      theme === 'dark' ? 'bg-[#050505]' : 'bg-gray-50'
    )}>
      <div className={cn(
        "w-full max-w-lg rounded-2xl border p-8",
        theme === 'dark' 
          ? 'bg-zinc-900/90 border-white/10' 
          : 'bg-white border-gray-200 shadow-xl'
      )}>
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                idx === currentStep 
                  ? 'w-8 bg-emerald-500' 
                  : idx < currentStep 
                    ? 'bg-emerald-500/50' 
                    : theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-300'
              )}
            />
          ))}
        </div>

        {/* Step Icon */}
        <div className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6",
          `bg-${step.color}-500/20`
        )}>
          <StepIcon className={`w-8 h-8 text-${step.color}-500`} />
        </div>

        {/* Step Title */}
        <h1 className={cn(
          "text-2xl font-bold text-center mb-2",
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          {step.title}
        </h1>
        <p className={cn(
          "text-center mb-8",
          theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
        )}>
          {step.subtitle}
        </p>

        {/* Step Content */}
        <div className="mb-8">
          {step.id === 'welcome' && (
            <div className="space-y-4">
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'
              )}>
                <div className="flex items-center gap-3 mb-2">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                    Track protein with amino acid breakdown
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                    Monitor Omega-3 & Omega-6 fatty acids
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                    Get personalized keto-friendly suggestions
                  </span>
                </div>
              </div>
            </div>
          )}

          {step.id === 'protein' && (
            <div className="space-y-4">
              <div className={cn(
                "p-6 rounded-xl text-center",
                theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'
              )}>
                <input
                  type="number"
                  value={proteinGoal}
                  onChange={(e) => setProteinGoal(parseInt(e.target.value) || 100)}
                  className={cn(
                    "w-32 text-4xl font-bold text-center bg-transparent border-b-2 border-emerald-500 outline-none",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}
                />
                <span className={cn(
                  "text-2xl ml-2",
                  theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                )}>g/day</span>
              </div>
              <div className="flex justify-center gap-2">
                {[100, 150, 200].map(val => (
                  <button
                    key={val}
                    onClick={() => setProteinGoal(val)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      proteinGoal === val
                        ? 'bg-emerald-500 text-black'
                        : theme === 'dark' 
                          ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' 
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    )}
                  >
                    {val}g
                  </button>
                ))}
              </div>
            </div>
          )}

          {step.id === 'carbs' && (
            <div className="space-y-3">
              {ketoLevels.map(level => (
                <button
                  key={level.value}
                  onClick={() => setCarbLimit(level.value)}
                  className={cn(
                    "w-full p-4 rounded-xl border text-left transition-all",
                    carbLimit === level.value
                      ? `bg-${level.color}-500/10 border-${level.color}-500/50`
                      : theme === 'dark'
                        ? 'bg-black/30 border-white/5 hover:border-white/10'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn(
                        "font-semibold",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{level.label}</p>
                      <p className={cn(
                        "text-sm",
                        theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                      )}>{level.desc}</p>
                    </div>
                    <div className={cn(
                      "text-xl font-bold",
                      `text-${level.color}-500`
                    )}>{level.value}g</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step.id === 'learn' && (
            <div className="space-y-4">
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-violet-50 border border-violet-200'
              )}>
                <div className="flex items-start gap-3">
                  <Dna className="w-5 h-5 text-violet-500 mt-0.5" />
                  <div>
                    <p className={cn(
                      "font-semibold",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Amino Acid Analysis</p>
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                    )}>See if your protein sources are "complete" with all 9 essential amino acids</p>
                  </div>
                </div>
              </div>
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-cyan-50 border border-cyan-200'
              )}>
                <div className="flex items-start gap-3">
                  <Droplets className="w-5 h-5 text-cyan-500 mt-0.5" />
                  <div>
                    <p className={cn(
                      "font-semibold",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Fatty Acid Tracking</p>
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                    )}>Monitor your Omega-3 to Omega-6 ratio for optimal health</p>
                  </div>
                </div>
              </div>
              <p className={cn(
                "text-center text-sm",
                theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
              )}>
                Look for the <span className="text-emerald-500">info icons</span> throughout the app to learn more!
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {currentStep > 0 ? (
            <button
              onClick={handleBack}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                theme === 'dark' 
                  ? 'text-zinc-400 hover:text-white' 
                  : 'text-gray-500 hover:text-gray-900'
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-2 rounded-lg transition-all"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={saving}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-2 rounded-lg transition-all disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Get Started
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
