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
  DollarSign
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

// Feature data
const FEATURES = [
  {
    icon: AlertTriangle,
    title: "AI Speed Prediction",
    description: "Warns you BEFORE entering lower speed zones. Our AI looks ahead and alerts you in advance.",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10"
  },
  {
    icon: Eye,
    title: "HUD Windshield Mode",
    description: "Mirror display projects onto your windshield. Keep your eyes on the road, not your phone.",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10"
  },
  {
    icon: Volume2,
    title: "Customizable Alerts",
    description: "6 different alert sounds, adjustable volume, and voice warnings in 12+ languages.",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10"
  },
  {
    icon: Zap,
    title: "Dynamic Thresholds",
    description: "Set different tolerances for different speed zones. +0 in school zones, +10 on highways.",
    color: "text-green-400",
    bgColor: "bg-green-500/10"
  },
  {
    icon: Wifi,
    title: "Works Offline",
    description: "Speed limits cached locally. Works even with poor cell signal in rural areas.",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10"
  },
  {
    icon: Battery,
    title: "Battery Optimized",
    description: "Low power mode and smart GPS reduce battery drain. Drive all day on one charge.",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10"
  }
];

// Testimonials
const TESTIMONIALS = [
  {
    name: "Marcus T.",
    role: "Uber Driver",
    image: "🚗",
    text: "I drive 8+ hours a day. This app has saved me from at least 3 tickets in the past month. The AI prediction feature is incredible.",
    rating: 5
  },
  {
    name: "Jennifer L.",
    role: "Mom of Teen Driver",
    image: "👩",
    text: "Finally have peace of mind when my daughter drives. The voice alerts keep her aware without being distracting.",
    rating: 5
  },
  {
    name: "David R.",
    role: "Motorcycle Rider",
    image: "🏍️",
    text: "The HUD mode is a game-changer for my helmet display. I can see my speed without looking down.",
    rating: 5
  }
];

// Pricing plans
const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Basic speed alerts",
    features: [
      "Real-time speed alerts",
      "1 alert sound",
      "Basic speed limit data",
      "Ad-supported"
    ],
    cta: "Get Started",
    highlighted: false
  },
  {
    name: "Premium",
    price: "$3.99",
    period: "/month",
    description: "Full protection",
    features: [
      "Everything in Free",
      "AI Speed Prediction",
      "HUD Windshield Mode",
      "6 custom alert sounds",
      "12+ voice languages",
      "Dynamic thresholds",
      "No ads",
      "Priority support"
    ],
    cta: "Start Free Trial",
    highlighted: true,
    badge: "Most Popular"
  },
  {
    name: "Annual",
    price: "$29.99",
    period: "/year",
    description: "Save 37%",
    features: [
      "Everything in Premium",
      "Billed annually",
      "Save $17.89/year",
      "Family sharing (5 devices)"
    ],
    cta: "Best Value",
    highlighted: false
  }
];

// FAQ data
const FAQS = [
  {
    question: "How does the AI speed prediction work?",
    answer: "Our AI analyzes your direction of travel and checks speed limits up to 1km ahead. When it detects you're approaching a lower speed zone, it warns you in advance so you have time to slow down safely."
  },
  {
    question: "Does it work without internet?",
    answer: "Yes! Speed limits are cached on your device. Once you've driven a route, the speed limits are stored locally and work even without cell signal."
  },
  {
    question: "How is this different from Waze or Google Maps?",
    answer: "Unlike navigation apps, we're focused 100% on speed safety. Our unique features like HUD windshield mode, AI prediction, and customizable alert thresholds aren't available anywhere else."
  },
  {
    question: "Will it drain my battery?",
    answer: "We've optimized for all-day use. Low Power Mode reduces GPS polling when you're stationary, and smart caching minimizes data usage. Most users see less than 10% battery drain per hour."
  },
  {
    question: "Is my location data private?",
    answer: "Absolutely. Your location data never leaves your device. We don't track, store, or sell your driving history. Everything is processed locally."
  }
];

export default function LandingPage({ onEnterApp }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

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
              <span className="text-xl font-bold">SpeedShield</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-zinc-400 hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-zinc-400 hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="text-zinc-400 hover:text-white transition-colors">FAQ</a>
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
              <a href="#pricing" className="block text-zinc-400 hover:text-white">Pricing</a>
              <a href="#faq" className="block text-zinc-400 hover:text-white">FAQ</a>
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-8">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-400 font-medium">AI-Powered Speed Protection</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Never Get Another{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                Speeding Ticket
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
              The only speed alert app with AI prediction that warns you{" "}
              <span className="text-white font-semibold">before</span> you enter speed traps. 
              HUD mode, custom alerts, works offline.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Button 
                onClick={onEnterApp}
                size="lg"
                className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-700 text-lg px-8 py-6"
              >
                Try Free Now
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-zinc-700 hover:bg-zinc-800 text-lg px-8 py-6"
                onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Play className="mr-2 w-5 h-5" />
                Watch Demo
              </Button>
            </div>

            {/* Social Proof */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-zinc-500">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
                <span className="ml-2">4.9/5 rating</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-zinc-700" />
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-500" />
                <span>No credit card required</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-zinc-700" />
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-500" />
                <span>Works on any device</span>
              </div>
            </div>
          </div>

          {/* Hero Image/Demo */}
          <div id="demo" className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent z-10 pointer-events-none" />
            <div className="relative mx-auto max-w-4xl">
              {/* Phone mockup */}
              <div className="relative mx-auto w-72 sm:w-80">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-[3rem] blur-3xl opacity-20" />
                <div className="relative bg-zinc-900 rounded-[2.5rem] p-3 border border-zinc-800">
                  <div className="bg-zinc-950 rounded-[2rem] overflow-hidden aspect-[9/19]">
                    {/* App screenshot placeholder */}
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-32 h-32 rounded-full border-4 border-cyan-500/30 flex items-center justify-center mb-4">
                        <span className="text-5xl font-bold text-cyan-400">47</span>
                      </div>
                      <p className="text-zinc-400 text-sm mb-2">CURRENT SPEED</p>
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full">
                        <Check className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 text-sm font-medium">SAFE</span>
                      </div>
                      <p className="text-zinc-600 text-xs mt-4">Speed Limit: 55 mph</p>
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
              { value: "$287", label: "Avg. ticket cost saved" },
              { value: "500ms", label: "Alert response time" },
              { value: "99.2%", label: "Speed limit accuracy" },
              { value: "24/7", label: "Offline availability" }
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
              <span className="text-cyan-400">Drive Safe</span>
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Powerful features designed by drivers, for drivers. 
              Stay protected without distraction.
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
              Get protected in under 60 seconds. No app store needed.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                icon: Globe,
                title: "Open in Browser",
                description: "Visit our website on your phone. No download required - works instantly as a web app."
              },
              {
                step: "2",
                icon: Navigation,
                title: "Enable Location",
                description: "Allow location access so we can track your speed and fetch local speed limits."
              },
              {
                step: "3",
                icon: Shield,
                title: "Drive Protected",
                description: "Mount your phone and go. Get alerts when you exceed speed limits."
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
              Loved by Drivers
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Join thousands of drivers who&apos;ve saved money and stayed safe.
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
              <span className="font-bold">SpeedShield</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-zinc-500">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <div className="text-sm text-zinc-600">
              © 2025 SpeedShield. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
