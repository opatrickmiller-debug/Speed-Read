import { Sidebar, MobileNav } from './Sidebar';
import { useTheme } from '../context/ThemeContext';

export const Layout = ({ children }) => {
  const { theme } = useTheme();
  
  return (
    <div className={`min-h-screen h-auto transition-colors duration-300 ${
      theme === 'dark' ? 'bg-[#050505]' : 'bg-gray-50'
    }`}>
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      
      {/* Mobile Nav */}
      <MobileNav />
      
      {/* Main Content - with safe area padding for notched devices */}
      <main 
        className="md:ml-64 pb-20 md:pb-0"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)'
        }}
      >
        {theme === 'dark' && (
          <>
            <div className="hero-glow fixed inset-0 pointer-events-none" style={{ zIndex: -1 }} />
            <div className="grid-bg fixed inset-0 pointer-events-none opacity-50" style={{ zIndex: -1 }} />
          </>
        )}
        <div className="relative">
          {children}
        </div>
      </main>
    </div>
  );
};
