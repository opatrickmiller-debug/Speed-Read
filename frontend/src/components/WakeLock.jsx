import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Wake Lock Hook - Keeps screen awake during driving
 * Uses the Screen Wake Lock API (supported in most modern browsers)
 * Falls back to video-based approach for older browsers
 */
export function useWakeLock() {
  const [isSupported] = useState(() => 'wakeLock' in navigator);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);
  const wakeLockRef = useRef(null);
  const videoRef = useRef(null);
  const retryIntervalRef = useRef(null);
  const shouldBeActiveRef = useRef(false);

  // Request wake lock
  const requestWakeLock = useCallback(async () => {
    setError(null);
    shouldBeActiveRef.current = true;

    // Try native Wake Lock API first
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        setIsActive(true);
        
        // Listen for release and auto-reacquire
        wakeLockRef.current.addEventListener('release', () => {
          console.log('Wake Lock released, will try to reacquire...');
          setIsActive(false);
          // Auto-reacquire if it should be active - use setTimeout to break out of callback
          if (shouldBeActiveRef.current && document.visibilityState === 'visible') {
            setTimeout(async () => {
              if (shouldBeActiveRef.current && 'wakeLock' in navigator) {
                try {
                  wakeLockRef.current = await navigator.wakeLock.request('screen');
                  setIsActive(true);
                  console.log('Wake Lock reacquired');
                } catch (e) {
                  console.log('Failed to reacquire wake lock:', e);
                }
              }
            }, 1000);
          }
        });
        
        console.log('Wake Lock acquired');
        return true;
      } catch (err) {
        console.error('Wake Lock error:', err);
        setError(err.message);
        // Fall through to video fallback
      }
    }

    // Fallback: Create invisible video that plays to keep screen awake
    // This works on iOS Safari and older browsers
    try {
      if (!videoRef.current) {
        const video = document.createElement('video');
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        video.setAttribute('loop', '');
        video.style.position = 'fixed';
        video.style.top = '-1px';
        video.style.left = '-1px';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.opacity = '0.01';
        video.style.pointerEvents = 'none';
        
        // Tiny black video (base64 encoded 1x1 pixel MP4)
        video.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAA0NtZGF0AAACrQYF//+p3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1NSByMjkwMSA3ZDBmZjIyIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxOCAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTMgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAD2WIhAA3//728P4FNjuZQQAAAu5tb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAZAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACGHRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAZAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAgAAAAIAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAAGQAAAAAAAEAAAAAAZBtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAACgAAAAEAFXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAE7bWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAA+3N0YmwAAACXc3RzZAAAAAAAAAABAAAAh2F2YzEAAAAAAAAAAQACAAAAAAAAAAAAAAAAAAAAAgACAEgAAABIAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY//8AAAAxYXZjQwFkAAr/4QAYZ2QACqzZX4iIhAAAAwAEAAADAFA8SJZYAQAGaOvjyyLAAAAAGHN0dHMAAAAAAAAAAQAAAAEAAAQAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAAQAAABRzdHN6AAAAAAAAAsUAAAABAAAAFHN0Y28AAAAAAAAAAQAAADAAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjU4LjI5LjEwMA==';
        
        document.body.appendChild(video);
        videoRef.current = video;
      }
      
      await videoRef.current.play();
      setIsActive(true);
      console.log('Wake Lock fallback (video) active');
      return true;
    } catch (err) {
      console.error('Video fallback error:', err);
      setError('Could not keep screen awake');
      return false;
    }
  }, []);

  // Release wake lock
  const releaseWakeLock = useCallback(async () => {
    shouldBeActiveRef.current = false;
    
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
    
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.error('Wake Lock release error:', err);
      }
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.remove();
      videoRef.current = null;
    }
    
    setIsActive(false);
  }, []);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && shouldBeActiveRef.current) {
        console.log('Page visible, reacquiring wake lock...');
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [requestWakeLock]);

  // Periodic check to ensure wake lock is still active
  useEffect(() => {
    if (shouldBeActiveRef.current) {
      retryIntervalRef.current = setInterval(async () => {
        if (shouldBeActiveRef.current && !wakeLockRef.current && document.visibilityState === 'visible') {
          console.log('Wake lock lost, reacquiring...');
          await requestWakeLock();
        }
      }, 10000); // Check every 10 seconds
    }
    
    return () => {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
      }
    };
  }, [requestWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  return {
    isSupported,
    isActive,
    error,
    requestWakeLock,
    releaseWakeLock,
    toggle: async () => {
      if (isActive) {
        await releaseWakeLock();
      } else {
        await requestWakeLock();
      }
    }
  };
}

/**
 * Wake Lock Toggle Component for Settings
 */
import { Moon, Sun, Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function WakeLockToggle({ isActive, onToggle, className }) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-3">
        <Smartphone className={cn(
          "w-5 h-5",
          isActive ? "text-cyan-500" : "text-zinc-500"
        )} />
        <div>
          <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider block">
            Keep Screen On
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            Prevents phone from sleeping while driving
          </span>
        </div>
      </div>
      <Switch
        checked={isActive}
        onCheckedChange={onToggle}
        className="data-[state=checked]:bg-cyan-500"
      />
    </div>
  );
}
