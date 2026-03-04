import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import {
  LayoutDashboard,
  Search,
  CalendarDays,
  Heart,
  TrendingUp,
  Settings,
  LogOut,
  Dna,
  UtensilsCrossed,
  ScanBarcode,
  Sparkles,
  ChefHat,
  MoreHorizontal,
  PlusCircle,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/search', icon: Search, label: 'Food Search' },
  { to: '/barcode', icon: ScanBarcode, label: 'Barcode Scan' },
  { to: '/log', icon: UtensilsCrossed, label: 'Food Log' },
  { to: '/meal-builder', icon: ChefHat, label: 'Meal Builder' },
  { to: '/suggestions', icon: Sparkles, label: 'Suggestions' },
  { to: '/meal-plans', icon: CalendarDays, label: 'Meal Plans' },
  { to: '/custom-foods', icon: PlusCircle, label: 'Custom Foods' },
  { to: '/favorites', icon: Heart, label: 'Favorites' },
  { to: '/trends', icon: TrendingUp, label: 'Trends' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-zinc-950 border-r border-white/5 flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Dna className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-white text-lg tracking-tight">
              Isotope
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">
              Protein Tracker
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              )
            }
          >
            <item.icon className="w-5 h-5" strokeWidth={1.5} />
            <span className="font-medium text-sm">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-black font-bold text-sm">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export const MobileNav = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [showMore, setShowMore] = React.useState(false);

  const mainNavItems = navItems.slice(0, 4);
  const moreNavItems = navItems.slice(4);

  return (
    <>
      {/* More Menu Overlay */}
      {showMore && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setShowMore(false)}
        />
      )}
      
      {/* More Menu */}
      {showMore && (
        <div className="fixed bottom-20 left-4 right-4 bg-zinc-900 border border-white/10 rounded-2xl p-4 z-50 md:hidden animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-3 gap-2">
            {moreNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setShowMore(false)}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-2 p-3 rounded-xl transition-all',
                    isActive 
                      ? 'bg-emerald-500/10 text-emerald-400' 
                      : 'text-zinc-400 hover:bg-white/5'
                  )
                }
              >
                <item.icon className="w-5 h-5" strokeWidth={1.5} />
                <span className="text-[10px] text-center">{item.label}</span>
              </NavLink>
            ))}
          </div>
          
          {/* User & Logout */}
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-black font-bold text-xs">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-sm text-zinc-400 truncate max-w-[120px]">{user?.name}</span>
            </div>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-t border-white/5 px-2 py-2 z-50 md:hidden safe-area-inset-bottom">
        <div className="flex items-center justify-around">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px]',
                  isActive ? 'text-emerald-400' : 'text-zinc-500'
                )
              }
            >
              <item.icon className="w-5 h-5" strokeWidth={1.5} />
              <span className="text-[10px]">{item.label.split(' ')[0]}</span>
            </NavLink>
          ))}
          
          {/* More Button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px]',
              showMore ? 'text-emerald-400' : 'text-zinc-500'
            )}
          >
            <MoreHorizontal className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-[10px]">More</span>
          </button>
        </div>
      </nav>
    </>
  );
};
