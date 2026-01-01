import { useState, useEffect } from "react";
import { 
  Gauge, 
  Shield, 
  Bell, 
  Smartphone, 
  Zap, 
  Eye,
  Volume2,
  Globe,
  Battery,
  Wifi,
  ChevronRight,
  Check,
  Star,
  Play,
  Menu,
  X,
  ArrowRight,
  AlertTriangle,
  Navigation,
  Clock,
  DollarSign,
  TrendingUp,
  GraduationCap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Auto-wake backend while user views landing page
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const useAutoWake = () => {
  const [isWaking, setIsWaking] = useState(true);
  const [isAwake, setIsAwake] = useState(false);
  
  useEffect(() => {
    let mounted = true;
    
    const wakeServers = async () => {
      for (let i = 0; i < 5; i++) {
        if (!mounted) return;
        try {
          const response = await fetch(`${BACKEND_URL}/api/health`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
          });
          if (response.ok && mounted) {
            setIsAwake(true);
            setIsWaking(false);
            console.log('[LandingPage] Backend is awake!');
            return;
          }
        } catch (e) {
          // Keep trying
        }
        await new Promise(r => setTimeout(r, 1500));
      }
      if (mounted) setIsWaking(false);
    };
    
    wakeServers();
    return () => { mounted = false; };
  }, []);
  
  return { isWaking, isAwake };
};

// Feature data - Driver Training Focus
const FEATURES = [
  {
    icon: Clock,
    title: "Automatic Hour Tracking",
    description: "Log practice hours automatically. Track day vs night driving to meet your state's permit requirements.",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10"
  },
  {
    icon: TrendingUp,
    title: "Safety Scores & Grades",
    description: "Get a driving grade (A+ to F) based on speed compliance, smooth braking, and safe habits.",
    color: "text-green-400",
    bgColor: "bg-green-500/10"
  },
  {
    icon: AlertTriangle,
    title: "Real-Time Speed Coaching",
    description: "Audio alerts when approaching speed limits. Learn to recognize zones before it becomes a habit.",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10"
  },
  {
    icon: Eye,
    title: "Parent Dashboard",
    description: "Parents see real progress, not just location. View safety scores, practice hours, and trip history.",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10"
  },
  {
    icon: Shield,
    title: "Share with Instructors",
    description: "Connect with your driving instructor. They can track your progress and provide targeted feedback.",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10"
  },
  {
    icon: Smartphone,
    title: "Works Everywhere",
    description: "No special hardware needed. Works offline, optimized for battery life. Mount and drive.",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10"
  }
];

// Testimonials - Driver Training Focus
const TESTIMONIALS = [
  {
    name: "Sarah M.",
    role: "Parent of New Driver",
    image: "👩",
    text: "My son went from a C to an A+ in just 3 weeks. The real-time feedback taught him habits I couldn't explain in words.",
    rating: 5
  },
  {
    name: "Jennifer L.",
    role: "Mom of Teen Driver",
    image: "👩",
    text: "Finally have peace of mind when my daughter drives. I can see her actual safety score, not just where she went.",
    rating: 5
  },
  {
    name: "Mike R.",
    role: "Driving Instructor",
    image: "🚙",
    text: "I recommend DriveCoach to all my students. The progress tracking helps me focus lessons on what they actually need.",
    rating: 5
  }
];

// Pricing plans - Training Focus
const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Start learning",
    features: [
      "5 practice sessions/month",
      "Basic hour tracking",
      "Speed alerts",
      "1 parent share link"
    ],
    cta: "Get Started",
    highlighted: false
  },
  {
    name: "Student",
    price: "$4.99",
    period: "/month",
    description: "Full training suite",
    features: [
      "Unlimited practice sessions",
      "Detailed safety scores",
      "Day/night hour tracking",
      "3 share links",
      "Progress badges",
      "CSV/PDF exports"
    ],
    cta: "Start Free Trial",
    highlighted: true,
    badge: "Most Popular"
  },
  {
    name: "Family",
    price: "$49.99",
    period: "/year",
    description: "Perfect for permit period",
    features: [
      "Everything in Student",
      "Multiple teen drivers",
      "Parent dashboard",
      "Priority support",
      "Save 17%"
    ],
    cta: "Best Value",
    highlighted: false
  }
];

// FAQ data - Training Focus
const FAQS = [
  {
    question: "How does practice hour tracking work?",
    answer: "DriveCoach automatically detects when you start driving (speed > 5 mph) and logs your practice time. It tracks day vs night hours separately to meet your state's permit requirements."
  },
  {
    question: "What states are supported?",
    answer: "We have requirements for all 50 US states plus DC. Select your state in settings and we'll show your progress toward the required hours (typically 30-100 total, with 10-15 at night)."
  },
  {
    question: "How do safety scores work?",
    answer: "Your driving grade (A+ to F) is based on speed compliance, smooth braking, and consistent driving. Each trip gets a score, and we track your weekly and monthly averages."
  },
  {
    question: "Can my parents see my driving?",
    answer: "Yes! You can share a progress link with parents or instructors. They'll see your safety scores, practice hours, and trip history - but not your exact location in real-time."
  },
  {
    question: "Is my data private?",
    answer: "Your location data stays on your device. Parents only see what you choose to share via the progress link. We never sell your data or track you without consent."
  }
];

export default function LandingPage({ onEnterApp }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  
  // Auto-wake backend while user views landing page
  const { isAwake } = useAutoWake();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Gauge className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold">DriveCoach</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-zinc-400 hover:text-white transition-colors">Features</a>
              <a href="#parents" className="text-purple-400 hover:text-purple-300 transition-colors font-medium">For Parents</a>
              <a href="#pricing" className="text-zinc-400 hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="text-zinc-400 hover:text-white transition-colors">FAQ</a>
              <a href="/instructor" className="text-cyan-400 hover:text-cyan-300 transition-colors">Instructors</a>
              <Button 
                onClick={onEnterApp}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                Open App
              </Button>
            </div>

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-zinc-900 border-t border-zinc-800">
            <div className="px-4 py-4 space-y-4">
              <a href="#features" className="block text-zinc-400 hover:text-white">Features</a>
              <a href="#parents" className="block text-purple-400 hover:text-purple-300 font-medium">For Parents</a>
              <a href="#pricing" className="block text-zinc-400 hover:text-white">Pricing</a>
              <a href="#faq" className="block text-zinc-400 hover:text-white">FAQ</a>
              <a href="/instructor" className="block text-cyan-400 hover:text-cyan-300">Instructors</a>
              <Button 
                onClick={onEnterApp}
                className="w-full bg-cyan-600 hover:bg-cyan-700"
              >
                Open App
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-8">
              <GraduationCap className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-400 font-medium">The #1 Driver Training App</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Turn Your Teen Into a{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
                Confident Driver
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
              Track practice hours, build safe habits with real-time coaching, and{" "}
              <span className="text-white font-semibold">see actual progress</span> - not just miles driven.
              Meet permit requirements faster.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Button 
                onClick={onEnterApp}
                size="lg"
                className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-700 text-lg px-8 py-6"
              >
                Start Free Training
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-zinc-700 hover:bg-zinc-800 text-lg px-8 py-6"
                onClick={() => document.getElementById('parents')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Shield className="mr-2 w-5 h-5" />
                For Parents
              </Button>
            </div>

            {/* Social Proof */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-zinc-500">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
                <span className="ml-2">4.9/5 from parents</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-zinc-700" />
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-500" />
                <span>50 states supported</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-zinc-700" />
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span>10,000+ teens trained</span>
              </div>
            </div>
          </div>

          {/* Hero Image/Demo */}
          <div id="demo" className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent z-10 pointer-events-none" />
            <div className="relative mx-auto max-w-4xl">
              {/* Phone mockup */}
              <div className="relative mx-auto w-72 sm:w-80">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-[3rem] blur-3xl opacity-20" />
                <div className="relative bg-zinc-900 rounded-[2.5rem] p-3 border border-zinc-800">
                  <div className="bg-zinc-950 rounded-[2rem] overflow-hidden aspect-[9/19]">
                    {/* App screenshot placeholder */}
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-32 h-32 rounded-full border-4 border-green-500/30 flex items-center justify-center mb-4">
                        <span className="text-5xl font-bold text-green-400">A+</span>
                      </div>
                      <p className="text-zinc-400 text-sm mb-2">DRIVING GRADE</p>
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full">
                        <Check className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 text-sm font-medium">EXCELLENT</span>
                      </div>
                      <p className="text-zinc-600 text-xs mt-4">32.5 hours logged</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y border-zinc-800 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "50", label: "States supported" },
              { value: "10K+", label: "Teens trained" },
              { value: "2M+", label: "Practice hours logged" },
              { value: "A+", label: "Avg. graduate grade" }
            ].map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need to{" "}
              <span className="text-cyan-400">Learn to Drive</span>
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Track progress, build safe habits, and meet your state&apos;s permit requirements.
              The complete driver training toolkit.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, idx) => (
              <div 
                key={idx}
                className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", feature.bgColor)}>
                  <feature.icon className={cn("w-6 h-6", feature.color)} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-zinc-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Start tracking progress in under 60 seconds. No app store needed.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                icon: Smartphone,
                title: "Open & Mount",
                description: "Visit our website on your phone, select your state, and mount it in your car. Works as a web app."
              },
              {
                step: "2",
                icon: Navigation,
                title: "Practice Driving",
                description: "DriveCoach automatically tracks your practice hours, day vs night, and monitors your driving habits."
              },
              {
                step: "3",
                icon: TrendingUp,
                title: "Improve & Share",
                description: "Watch your safety score improve over time. Share progress with parents or instructors."
              }
            ].map((item, idx) => (
              <div key={idx} className="text-center">
                <div className="relative inline-flex mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
                    <item.icon className="w-8 h-8 text-cyan-400" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Trusted by Families
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Join thousands of families who&apos;ve used DriveCoach to train confident, safe drivers.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((testimonial, idx) => (
              <div 
                key={idx}
                className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-zinc-300 mb-6">&ldquo;{testimonial.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xl">
                    {testimonial.image}
                  </div>
                  <div>
                    <div className="font-medium">{testimonial.name}</div>
                    <div className="text-sm text-zinc-500">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Parents Section - NEW */}
      <section id="parents" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-purple-950/20 to-zinc-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-400 font-medium">For Parents of Teen Drivers</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Know How Your Teen{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                Really Drives
              </span>
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto text-lg">
              Don&apos;t just track location. See their speed, safety score, and practice hours. 
              Help them become better drivers, not just watched drivers.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            {[
              { value: "68%", label: "of teens use apps while driving", color: "text-red-400" },
              { value: "#1", label: "cause of teen death is car crashes", color: "text-orange-400" },
              { value: "50%", label: "crash risk reduction with practice", color: "text-green-400" },
              { value: "30-100", label: "supervised hours required for permits", color: "text-cyan-400" }
            ].map((stat, idx) => (
              <div key={idx} className="text-center p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                <div className={cn("text-3xl sm:text-4xl font-bold mb-2", stat.color)}>{stat.value}</div>
                <div className="text-sm text-zinc-400">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Features for Parents */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              {
                icon: Eye,
                title: "Real-Time Speed Visibility",
                description: "See when they speed, not just where they go. Know if they're driving safely.",
                color: "text-cyan-400"
              },
              {
                icon: Clock,
                title: "Practice Hour Tracking",
                description: "Automatically track day and night hours. Meet state permit requirements.",
                color: "text-purple-400"
              },
              {
                icon: TrendingUp,
                title: "Progress Reports",
                description: "Weekly safety scores. See improvement over time. Share with instructors.",
                color: "text-green-400"
              }
            ].map((feature, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                <feature.icon className={cn("w-8 h-8 mb-4", feature.color)} />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-zinc-400">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Parent Testimonials */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {[
              {
                text: "Finally, I can see HOW my daughter drives, not just where. Her safety score improved from C to A+ in 2 months!",
                name: "Jennifer M.",
                role: "Parent of 16-year-old",
                emoji: "👩"
              },
              {
                text: "The practice hour tracker saved us so much hassle. No more paper logs. DMV accepted the export instantly.",
                name: "Robert K.",
                role: "Parent of 17-year-old", 
                emoji: "👨"
              }
            ].map((testimonial, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-purple-500/5 border border-purple-500/20">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-zinc-300 mb-6 text-lg">&ldquo;{testimonial.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-xl">
                    {testimonial.emoji}
                  </div>
                  <div>
                    <div className="font-medium">{testimonial.name}</div>
                    <div className="text-sm text-zinc-500">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Teen Driving Contract CTA */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900/50 to-pink-900/50 border border-purple-500/30 p-8 md:p-12">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
            <div className="relative grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl sm:text-3xl font-bold mb-4">
                  Free Teen Driving Contract
                </h3>
                <p className="text-zinc-300 mb-6">
                  Set clear expectations with your teen driver. Our contract covers phone use, 
                  passengers, curfews, and consequences. Used by 10,000+ families.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    onClick={onEnterApp}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Download Free Contract
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={onEnterApp}
                    className="border-purple-500/50 hover:bg-purple-500/10"
                  >
                    Try App Free
                  </Button>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="bg-zinc-900/80 rounded-xl p-6 border border-zinc-700 transform rotate-2">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="text-sm font-mono text-zinc-400">
                    <div className="mb-2">📋 TEEN DRIVING CONTRACT</div>
                    <div className="text-zinc-500 text-xs space-y-1">
                      <div>✓ No phone use while driving</div>
                      <div>✓ Max 1 passenger for 6 months</div>
                      <div>✓ Home by 10pm on school nights</div>
                      <div>✓ Maintain B+ or higher safety grade</div>
                      <div className="pt-2 border-t border-zinc-700 mt-2">
                        Signed: _____________ Date: _____
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For Instructors CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 p-8 md:p-12 text-center">
            <GraduationCap className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
            <h3 className="text-2xl sm:text-3xl font-bold mb-4">
              Are You a Driving Instructor?
            </h3>
            <p className="text-zinc-300 mb-6 max-w-xl mx-auto">
              Track all your students in one dashboard. Free forever for instructors. 
              See progress, safety scores, and practice hours across your entire roster.
            </p>
            <Button 
              onClick={() => window.location.href = '/instructor'}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              Open Instructor Portal
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Start free, upgrade when you&apos;re ready. One ticket saved pays for a year.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING.map((plan, idx) => (
              <div 
                key={idx}
                className={cn(
                  "relative p-6 rounded-2xl border",
                  plan.highlighted 
                    ? "bg-gradient-to-b from-cyan-950/50 to-zinc-900 border-cyan-500/50" 
                    : "bg-zinc-900/50 border-zinc-800"
                )}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-cyan-600 rounded-full text-xs font-medium">
                    {plan.badge}
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-zinc-500">{plan.period}</span>
                  </div>
                  <p className="text-sm text-zinc-500 mt-1">{plan.description}</p>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
                      <span className="text-zinc-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={onEnterApp}
                  className={cn(
                    "w-full",
                    plan.highlighted 
                      ? "bg-cyan-600 hover:bg-cyan-700" 
                      : "bg-zinc-800 hover:bg-zinc-700"
                  )}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => (
              <div 
                key={idx}
                className="border border-zinc-800 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-zinc-900/50 transition-colors"
                >
                  <span className="font-medium">{faq.question}</span>
                  <ChevronRight className={cn(
                    "w-5 h-5 text-zinc-500 transition-transform",
                    openFaq === idx && "rotate-90"
                  )} />
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-4 text-zinc-400">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-cyan-950 to-blue-950 border border-cyan-500/20">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to Stop Worrying About Speed Traps?
            </h2>
            <p className="text-zinc-400 mb-8 max-w-2xl mx-auto">
              Join thousands of drivers who drive with confidence. 
              Free to start, no credit card required.
            </p>
            <Button 
              onClick={onEnterApp}
              size="lg"
              className="bg-white text-zinc-900 hover:bg-zinc-100 text-lg px-8 py-6"
            >
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-zinc-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Gauge className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold">DriveCoach</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-zinc-500">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <div className="text-sm text-zinc-600">
              © 2025 DriveCoach. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
