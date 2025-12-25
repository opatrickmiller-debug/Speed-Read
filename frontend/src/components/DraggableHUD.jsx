import { useState, useRef, useEffect, useCallback } from "react";
import { Move, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hook for draggable functionality with persistence - MOBILE OPTIMIZED
 */
export function useDraggable(storageKey, defaultPosition = { x: 0, y: 0 }) {
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load position:', e);
    }
    return defaultPosition;
  });

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false); // Use ref for immediate updates
  const [isLocked, setIsLocked] = useState(() => {
    const saved = localStorage.getItem(`${storageKey}_locked`);
    return saved === 'true';
  });
  
  const dragRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startOffsetRef = useRef({ x: 0, y: 0 });
  const longPressTimerRef = useRef(null);
  const hasMoved = useRef(false);

  // Save position to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(position));
    } catch (e) {
      console.error('Failed to save position:', e);
    }
  }, [position, storageKey]);

  // Save lock state
  useEffect(() => {
    localStorage.setItem(`${storageKey}_locked`, isLocked.toString());
  }, [isLocked, storageKey]);

  // Haptic feedback
  const vibrate = useCallback((pattern = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const handleStart = useCallback((clientX, clientY) => {
    if (isLocked) return;
    
    isDraggingRef.current = true;
    setIsDragging(true);
    hasMoved.current = false;
    startPosRef.current = { x: clientX, y: clientY };
    startOffsetRef.current = { ...position };
    vibrate(15); // Short vibration on start
  }, [position, isLocked, vibrate]);

  const handleMove = useCallback((clientX, clientY) => {
    if (!isDraggingRef.current || isLocked) return;

    const deltaX = clientX - startPosRef.current.x;
    const deltaY = clientY - startPosRef.current.y;

    // Only start moving after 5px threshold (prevents accidental drags)
    if (!hasMoved.current && Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) {
      return;
    }
    hasMoved.current = true;

    // Get viewport bounds with padding
    const padding = 20;
    const maxX = window.innerWidth - 150;
    const maxY = window.innerHeight - 200;
    const minX = -50;
    const minY = 60; // Below toolbar

    const newX = Math.max(minX, Math.min(maxX, startOffsetRef.current.x + deltaX));
    const newY = Math.max(minY, Math.min(maxY, startOffsetRef.current.y + deltaY));

    setPosition({ x: newX, y: newY });
  }, [isLocked]);

  const handleEnd = useCallback(() => {
    if (isDraggingRef.current && hasMoved.current) {
      vibrate(10); // Short vibration on end
    }
    isDraggingRef.current = false;
    setIsDragging(false);
    
    // Clear any pending long press
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, [vibrate]);

  // Mouse events
  const onMouseDown = useCallback((e) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    handleStart(e.clientX, e.clientY);
  }, [handleStart, isLocked]);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e) => {
      handleMove(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      handleEnd();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, handleMove, handleEnd]);

  // Touch events - window listeners during drag for mobile
  useEffect(() => {
    if (!isDragging) return;

    const onTouchMoveWindow = (e) => {
      if (isLocked) return;
      e.preventDefault(); // Prevent scrolling while dragging
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };

    const onTouchEndWindow = () => {
      handleEnd();
    };

    // Use passive: false to allow preventDefault
    window.addEventListener('touchmove', onTouchMoveWindow, { passive: false });
    window.addEventListener('touchend', onTouchEndWindow);
    window.addEventListener('touchcancel', onTouchEndWindow);

    return () => {
      window.removeEventListener('touchmove', onTouchMoveWindow);
      window.removeEventListener('touchend', onTouchEndWindow);
      window.removeEventListener('touchcancel', onTouchEndWindow);
    };
  }, [isDragging, isLocked, handleMove, handleEnd]);

  // Touch events - start handler for drag handle
  const onTouchStart = useCallback((e) => {
    if (isLocked) return;
    e.stopPropagation();
    
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  }, [handleStart, isLocked]);

  // Keep these for element-level events (backup)
  const onTouchMove = useCallback((e) => {
    if (!isDragging || isLocked) return;
    e.preventDefault();
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  }, [isDragging, isLocked, handleMove]);

  const onTouchEnd = useCallback((e) => {
    e.stopPropagation();
    handleEnd();
  }, [handleEnd]);

  const resetPosition = useCallback(() => {
    setPosition(defaultPosition);
    vibrate([20, 50, 20]);
  }, [defaultPosition, vibrate]);

  const toggleLock = useCallback(() => {
    setIsLocked(prev => !prev);
    vibrate(25);
  }, [vibrate]);

  return {
    position,
    setPosition,
    isDragging,
    isLocked,
    toggleLock,
    resetPosition,
    dragHandlers: {
      onMouseDown,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    ref: dragRef,
  };
}

/**
 * Draggable wrapper component - MOBILE OPTIMIZED
 */
export function DraggableContainer({ 
  children, 
  storageKey,
  defaultPosition = { x: 0, y: 0 },
  className,
  onPositionChange,
}) {
  const { 
    position, 
    isDragging,
    isLocked,
    toggleLock,
    resetPosition,
    dragHandlers 
  } = useDraggable(storageKey, defaultPosition);

  const [showControls, setShowControls] = useState(false);
  const controlsTimerRef = useRef(null);

  useEffect(() => {
    onPositionChange?.(position);
  }, [position, onPositionChange]);

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (showControls && !isDragging) {
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, [showControls, isDragging]);

  // Show controls when dragging
  useEffect(() => {
    if (isDragging) {
      setShowControls(true);
    }
  }, [isDragging]);

  const handleTap = () => {
    setShowControls(prev => !prev);
  };

  return (
    <div
      className={cn(
        "absolute select-none",
        (isDragging || showControls) && "z-[9998]",
        className
      )}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging ? 'none' : 'transform 0.15s ease-out',
        touchAction: 'none', // Prevent default touch behaviors
      }}
    >
      {/* Large touch-friendly drag handle - MOBILE OPTIMIZED */}
      <div 
        className={cn(
          "absolute -top-14 left-1/2 -translate-x-1/2",
          "flex items-center gap-2",
          "transition-all duration-200",
          "z-[9999]", // Ensure controls are above toasts
          showControls || isDragging ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Lock/Unlock button */}
        <button
          onClick={toggleLock}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            "backdrop-blur-xl border-2 transition-all",
            isLocked 
              ? "bg-red-500/30 border-red-500/50 text-red-400" 
              : "bg-green-500/30 border-green-500/50 text-green-400"
          )}
        >
          {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
        </button>

        {/* Drag handle - larger for mobile */}
        <div 
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full",
            "backdrop-blur-xl border-2 transition-all",
            "cursor-grab active:cursor-grabbing",
            "min-h-[44px]", // iOS minimum touch target
            isDragging 
              ? "bg-cyan-500/40 border-cyan-400 scale-110" 
              : isLocked
              ? "bg-zinc-800/80 border-zinc-600 opacity-50"
              : "bg-black/70 border-white/20 hover:border-cyan-500/50"
          )}
          style={{ touchAction: 'none' }}
          {...(isLocked ? {} : dragHandlers)}
        >
          <Move className={cn(
            "w-5 h-5",
            isDragging ? "text-cyan-300" : "text-white/70"
          )} />
          <span className={cn(
            "text-xs font-mono uppercase font-medium",
            isDragging ? "text-cyan-300" : "text-white/70"
          )}>
            {isLocked ? "Locked" : isDragging ? "Moving..." : "Drag"}
          </span>
        </div>
      </div>
      
      {/* Tap area to show/hide controls */}
      <div 
        onClick={handleTap}
        onTouchEnd={(e) => {
          // Only toggle if not dragging
          if (!isDragging) {
            e.preventDefault();
            handleTap();
          }
        }}
        className="relative cursor-pointer"
        style={{ touchAction: 'manipulation' }}
      >
        {/* Dragging indicator ring */}
        {isDragging && (
          <div className="absolute inset-0 -m-2 rounded-2xl border-2 border-cyan-500/50 animate-pulse pointer-events-none" />
        )}
        
        {/* Content */}
        <div className={cn(
          "relative transition-transform duration-150",
          isDragging && "scale-[1.02]"
        )}>
          {children}
        </div>
      </div>

      {/* Position guide lines when dragging */}
      {isDragging && (
        <>
          <div className="fixed top-0 left-1/2 w-px h-full bg-cyan-500/20 pointer-events-none -translate-x-1/2" />
          <div className="fixed left-0 top-1/2 w-full h-px bg-cyan-500/20 pointer-events-none -translate-y-1/2" />
        </>
      )}
    </div>
  );
}

/**
 * Reset Position Button (for settings)
 */
export function ResetPositionButton({ onReset, label = "Reset Display Position" }) {
  const handleReset = () => {
    // Clear all position keys
    const keys = ['speedHudPosition', 'speedHudPosition_locked'];
    keys.forEach(key => localStorage.removeItem(key));
    onReset?.();
    // Reload to apply
    window.location.reload();
  };

  return (
    <button
      onClick={handleReset}
      className={cn(
        "w-full flex items-center justify-center gap-2 px-3 py-2",
        "text-xs font-mono uppercase tracking-wider",
        "bg-zinc-800/50 border border-zinc-700 text-zinc-400",
        "hover:bg-zinc-700/50 hover:text-zinc-300 transition-colors"
      )}
    >
      <Move className="w-3 h-3" />
      {label}
    </button>
  );
}
