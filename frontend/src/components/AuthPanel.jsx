import { useState } from "react";
import { User, LogOut, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const AuthPanel = () => {
  const { user, isAuthenticated, login, register, logout, isLoading } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isLoginMode) {
        await login(email, password);
        toast.success("Welcome back!");
      } else {
        await register(email, password);
        toast.success("Account created!");
      }
      setEmail("");
      setPassword("");
    } catch (error) {
      const message = error.response?.data?.detail || "Authentication failed";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.info("Logged out");
  };

  if (isLoading) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        className="backdrop-blur-xl bg-black/50 border border-white/10 rounded-none w-12 h-12"
      >
        <User className="w-5 h-5 text-zinc-500 animate-pulse" />
      </Button>
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          data-testid="auth-trigger"
          variant="ghost"
          size="icon"
          className={cn(
            "backdrop-blur-xl bg-black/50 border border-white/10",
            "hover:bg-black/70 hover:border-white/20",
            "rounded-none w-12 h-12",
            "transition-colors duration-200",
            isAuthenticated && "border-green-500/30 bg-green-500/10"
          )}
        >
          <User className={cn("w-5 h-5", isAuthenticated ? "text-green-400" : "text-zinc-300")} />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="backdrop-blur-xl bg-zinc-950/95 border-l border-white/10 w-[320px]"
      >
        <SheetHeader>
          <SheetTitle className="text-white font-chivo font-black uppercase tracking-wider flex items-center gap-2">
            <User className="w-5 h-5" />
            {isAuthenticated ? "Account" : "Sign In"}
          </SheetTitle>
          <SheetDescription className="text-zinc-500 font-mono text-xs">
            {isAuthenticated 
              ? "Manage your account and trip data" 
              : "Sign in to save your trips"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {isAuthenticated ? (
            <div className="space-y-4">
              {/* User Info */}
              <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded">
                <div className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-1">
                  Signed in as
                </div>
                <div className="text-zinc-200 font-mono text-sm truncate">
                  {user?.email}
                </div>
              </div>

              {/* Benefits */}
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded">
                <div className="text-green-400 text-xs font-mono uppercase tracking-wider mb-2">
                  Account Benefits
                </div>
                <ul className="text-zinc-400 text-xs font-mono space-y-1">
                  <li>• Trip history saved securely</li>
                  <li>• Access from any device</li>
                  <li>• Data synced to cloud</li>
                </ul>
              </div>

              {/* Logout Button */}
              <Button
                data-testid="logout-btn"
                onClick={handleLogout}
                className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Benefits reminder */}
              <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded">
                <div className="text-sky-400 text-xs font-mono">
                  Sign in to save your trips and access them from any device
                </div>
              </div>

              {/* Login/Register Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
                    Email
                  </label>
                  <Input
                    data-testid="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="bg-zinc-900 border-zinc-700 text-zinc-200"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
                    Password
                  </label>
                  <Input
                    data-testid="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-zinc-900 border-zinc-700 text-zinc-200"
                  />
                </div>

                <Button
                  data-testid="auth-submit"
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    "w-full",
                    isLoginMode
                      ? "bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/50"
                      : "bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50"
                  )}
                >
                  {isSubmitting ? (
                    "Please wait..."
                  ) : isLoginMode ? (
                    <>
                      <LogIn className="w-4 h-4 mr-2" />
                      Sign In
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Create Account
                    </>
                  )}
                </Button>
              </form>

              {/* Toggle Login/Register */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsLoginMode(!isLoginMode)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors"
                >
                  {isLoginMode
                    ? "Don't have an account? Register"
                    : "Already have an account? Sign In"}
                </button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
