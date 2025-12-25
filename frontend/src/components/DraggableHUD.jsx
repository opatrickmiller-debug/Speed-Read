import { useState, useRef, useEffect, useCallback } from "react";
import { GripVertical, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hook for draggable functionality with persistence
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
  const dragRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startOffsetRef = useRef({ x: 0, y: 0 });

  // Save position to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(position));
    } catch (e) {
      console.error('Failed to save position:', e);
    }
  }, [position, storageKey]);

  const handleStart = useCallback((clientX, clientY) => {
    setIsDragging(true);
    startPosRef.current = { x: clientX, y: clientY };
    startOffsetRef.current = { ...position };
  }, [position]);

  const handleMove = useCallback((clientX, clientY) => {
    if (!isDragging) return;

    const deltaX = clientX - startPosRef.current.x;
    const deltaY = clientY - startPosRef.current.y;

    // Get viewport bounds
    const maxX = window.innerWidth - 100;
    const maxY = window.innerHeight - 100;
    const minX = -100;
    const minY = 0;

    const newX = Math.max(minX, Math.min(maxX, startOffsetRef.current.x + deltaX));
    const newY = Math.max(minY, Math.min(maxY, startOffsetRef.current.y + deltaY));

    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse events
  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  }, [handleStart]);

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

  // Touch events
  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  }, [handleStart]);

  const onTouchMove = useCallback((e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  }, [isDragging, handleMove]);

  const onTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const resetPosition = useCallback(() => {
    setPosition(defaultPosition);
  }, [defaultPosition]);

  return {
    position,
    setPosition,
    isDragging,
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
 * Draggable wrapper component
 */
export function DraggableContainer({ 
  children, 
  storageKey,
  defaultPosition = { x: 0, y: 0 },
  showHandle = true,
  className,
  onPositionChange,
}) {
  const { 
    position, 
    isDragging, 
    resetPosition,
    dragHandlers 
  } = useDraggable(storageKey, defaultPosition);

  useEffect(() => {
    onPositionChange?.(position);
  }, [position, onPositionChange]);

  return (
    <div
      className={cn(
        "absolute touch-none select-none",
        isDragging && "z-50",
        className
      )}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
      }}
    >
      {/* Drag Handle */}
      {showHandle && (
        <div 
          className={cn(
            "absolute -top-6 left-1/2 -translate-x-1/2",
            "flex items-center gap-1 px-2 py-1 rounded-t-lg",
            "bg-black/60 backdrop-blur-sm",
            "cursor-grab active:cursor-grabbing",
            "opacity-60 hover:opacity-100 transition-opacity",
            isDragging && "opacity-100"
          )}
          {...dragHandlers}
        >
          <GripVertical className="w-4 h-4 text-white/70" />
          <span className="text-[10px] text-white/70 font-mono uppercase">Drag</span>
        </div>
      )}
      
      {/* Content */}
      <div className={cn(
        "relative",
        isDragging && "scale-105 transition-transform"
      )}>
        {children}
      </div>
    </div>
  );
}

/**
 * Reset Position Button (for settings)
 */
export function ResetPositionButton({ onReset, label = "Reset Display Position" }) {
  const handleReset = () => {
    // Clear all position keys
    const keys = ['speedometerPosition', 'speedLimitPosition', 'hudPosition'];
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
      <RotateCcw className="w-3 h-3" />
      {label}
    </button>
  );
}
