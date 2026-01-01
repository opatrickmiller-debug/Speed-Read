import { useState } from "react";
import { FileText, AlertTriangle, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportReportPanel } from "@/components/ExportReportPanel";
import { SpeedTrapPanel } from "@/components/SpeedTrapPanel";

const TABS = [
  { id: "report", label: "Report", icon: FileText, color: "text-sky-400" },
  { id: "traps", label: "Traps", icon: AlertTriangle, color: "text-orange-400" },
];

export function FeaturesPanel({ isOpen, onClose, currentPosition }) {
  const [activeTab, setActiveTab] = useState("report");

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
        <h2 className="text-white font-medium">
          {TABS.find(t => t.id === activeTab)?.label}
        </h2>
        <div className="w-16" /> {/* Spacer for centering */}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-3 transition-colors",
              activeTab === tab.id
                ? "bg-zinc-900/50 border-b-2 border-sky-500"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30"
            )}
          >
            <tab.icon className={cn(
              "w-5 h-5",
              activeTab === tab.id ? tab.color : ""
            )} />
            <span className="text-xs">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "report" && <ExportReportPanel />}
        {activeTab === "traps" && <SpeedTrapPanel currentPosition={currentPosition} />}
      </div>
    </div>
  );
}
