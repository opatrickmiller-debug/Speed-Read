import { useState } from "react";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpeedTrapPanel } from "@/components/SpeedTrapPanel";

export function FeaturesPanel({ isOpen, onClose, currentPosition }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-80 bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
        <h2 className="text-white font-medium flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
          Speed Traps
        </h2>
        <div className="w-16" /> {/* Spacer for centering */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <SpeedTrapPanel currentPosition={currentPosition} />
      </div>
    </div>
  );
}
