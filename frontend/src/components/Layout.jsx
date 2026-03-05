import { Sidebar, MobileNav } from './Sidebar';
import { useTheme } from '../context/ThemeContext';

export const Layout = ({ children }) => {
  const { theme } = useTheme();
  
  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark' ? 'bg-[#050505]' : 'bg-gray-50'
    }`}>
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      
      {/* Mobile Nav */}
      <MobileNav />
      
      {/* Main Content */}
      <main className="md:ml-64 min-h-screen pb-20 md:pb-0 overflow-y-auto">
        {theme === 'dark' && (
          <>
            <div className="hero-glow fixed inset-0 pointer-events-none" />
            <div className="grid-bg fixed inset-0 pointer-events-none opacity-50" />
          </>
        )}
        <div className="relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
};
