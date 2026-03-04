import { cn } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';

export const GlassCard = ({ children, className, hover = true, ...props }) => {
  const { theme } = useTheme();
  
  return (
    <div
      className={cn(
        'backdrop-blur-xl shadow-2xl rounded-2xl transition-all duration-300',
        theme === 'dark' 
          ? 'bg-zinc-900/40 border border-white/5' 
          : 'bg-white border border-gray-200 shadow-lg',
        hover && (theme === 'dark' ? 'hover:border-white/10' : 'hover:shadow-xl hover:border-gray-300'),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const GlassCardHeader = ({ children, className, ...props }) => {
  return (
    <div className={cn('p-6 pb-0', className)} {...props}>
      {children}
    </div>
  );
};

export const GlassCardContent = ({ children, className, ...props }) => {
  return (
    <div className={cn('p-6', className)} {...props}>
      {children}
    </div>
  );
};

export const GlassCardTitle = ({ children, className, ...props }) => {
  const { theme } = useTheme();
  
  return (
    <h3 className={cn(
      'text-lg font-semibold font-heading',
      theme === 'dark' ? 'text-white' : 'text-gray-900',
      className
    )} {...props}>
      {children}
    </h3>
  );
};

export const GlassCardDescription = ({ children, className, ...props }) => {
  const { theme } = useTheme();
  
  return (
    <p className={cn(
      'text-sm mt-1',
      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500',
      className
    )} {...props}>
      {children}
    </p>
  );
};
