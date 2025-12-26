import { useState } from "react";
import { User, LogOut, LogIn, UserPlus, Key, ArrowLeft } from "lucide-react";
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
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AuthPanel = () => {
  const { user, isAuthenticated, login, register, logout, isLoading, token } = useAuth();
  const [mode, setMode] = useState("login"); // login, register, change
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setNewPassword("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      resetForm();
    } catch (error) {
      const message = error.response?.data?.detail || "Authentication failed";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password);
      toast.success("Account created!");
      resetForm();
    } catch (error) {
      const message = error.response?.data?.detail || "Registration failed";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!password || !newPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: password,
        new_password: newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Password changed successfully!");
      resetForm();
      setMode("account");
    } catch (error) {
      const message = error.response?.data?.detail || "Failed to change password";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    setMode("login");
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

  const renderTitle = () => {
    switch (mode) {
      case "register": return "Create Account";
      case "change": return "Change Password";
      default: return isAuthenticated ? "Account" : "Sign In";
    }
  };

  const renderDescription = () => {
    switch (mode) {
      case "register": return "Create a new account to save your trips";
      case "change": return "Update your account password";
      default: return isAuthenticated ? "Manage your account" : "Sign in to save your trips";
    }
  };

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
            {renderTitle()}
          </SheetTitle>
          <SheetDescription className="text-zinc-500 font-mono text-xs">
            {renderDescription()}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {isAuthenticated && mode !== "change" ? (
            // Logged In - Account View
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
                  <li>• Stay signed in for 30 days</li>
                </ul>
              </div>

              {/* Change Password Button */}
              <Button
                onClick={() => setMode("change")}
                className="w-full bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 border border-zinc-700"
              >
                <Key className="w-4 h-4 mr-2" />
                Change Password
              </Button>

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
          ) : mode === "change" ? (
            // Change Password Form
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => { setMode("account"); resetForm(); }}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to Account
              </button>

              <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded">
                <div className="text-sky-400 text-xs font-mono">
                  Enter your current password and choose a new one (min 6 characters).
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
                    Current Password
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-zinc-900 border-zinc-700 text-zinc-200"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
                    New Password
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-zinc-900 border-zinc-700 text-zinc-200"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/50"
                >
                  {isSubmitting ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </div>
          ) : (
            // Login / Register Form
            <div className="space-y-4">
              {/* Benefits reminder */}
              <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded">
                <div className="text-sky-400 text-xs font-mono">
                  Sign in to save your trips and access them from any device
                </div>
              </div>

              {/* Login/Register Form */}
              <form onSubmit={mode === "register" ? handleRegister : handleLogin} className="space-y-4">
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
                    mode === "register"
                      ? "bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50"
                      : "bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/50"
                  )}
                >
                  {isSubmitting ? (
                    "Please wait..."
                  ) : mode === "register" ? (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Create Account
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 mr-2" />
                      Sign In
                    </>
                  )}
                </Button>
              </form>

              {/* Toggle Login/Register */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setMode(mode === "register" ? "login" : "register"); resetForm(); }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors"
                >
                  {mode === "register"
                    ? "Already have an account? Sign In"
                    : "Don't have an account? Register"}
                </button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
