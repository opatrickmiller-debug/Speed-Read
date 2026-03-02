import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GlassCard, GlassCardContent } from '../components/GlassCard';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dna, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await register(name, email, password);
      toast.success('Account created! Welcome to Isotope.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="hero-glow fixed inset-0 pointer-events-none" />
      <div className="grid-bg fixed inset-0 pointer-events-none opacity-30" />
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center animate-pulse-glow">
            <Dna className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-white text-3xl tracking-tight">
              Isotope
            </h1>
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
              Protein Tracker
            </p>
          </div>
        </div>

        <GlassCard className="overflow-hidden">
          <GlassCardContent className="p-8">
            <div className="mb-8">
              <h2 className="font-heading text-2xl font-semibold text-white">
                Create account
              </h2>
              <p className="text-zinc-500 mt-2 text-sm">
                Start tracking your amino acid synthesis today
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-zinc-400 text-sm">
                  Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  data-testid="register-name-input"
                  required
                  className="bg-black/50 border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-400 text-sm">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  data-testid="register-email-input"
                  required
                  className="bg-black/50 border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-400 text-sm">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  data-testid="register-password-input"
                  required
                  minLength={6}
                  className="bg-black/50 border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 h-12"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                data-testid="register-submit-btn"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 py-3.5 rounded-full transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-zinc-500 text-sm">
                Already have an account?{' '}
                <Link
                  to="/login"
                  data-testid="login-link"
                  className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>
    </div>
  );
};
