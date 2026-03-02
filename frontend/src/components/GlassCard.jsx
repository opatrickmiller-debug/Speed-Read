import { cn } from '../lib/utils';

export const GlassCard = ({ children, className, hover = true, ...props }) => {
  return (
    <div
      className={cn(
        'bg-zinc-900/40 backdrop-blur-xl border border-white/5 shadow-2xl rounded-2xl',
        hover && 'hover:border-white/10 transition-all duration-300',
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
  return (
    <h3 className={cn('text-lg font-semibold text-white font-heading', className)} {...props}>
      {children}
    </h3>
  );
};

export const GlassCardDescription = ({ children, className, ...props }) => {
  return (
    <p className={cn('text-sm text-zinc-500 mt-1', className)} {...props}>
      {children}
    </p>
  );
};
