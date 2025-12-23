import { useState } from "react";
import axios from "axios";
import { FileText, Download, Calendar, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function ExportReportPanel() {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const generateReport = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/reports/generate`, {
        start_date: dateRange.start,
        end_date: dateRange.end,
        format: "json"
      });
      setReport(response.data);
      toast.success("Report generated!");
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `driving-report-${report.report_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded!");
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-8">
        <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400 text-sm">Sign in to generate reports</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date Range */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">From</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(p => ({ ...p, start: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">To</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(p => ({ ...p, end: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white"
          />
        </div>
      </div>

      <Button
        onClick={generateReport}
        disabled={loading}
        className="w-full bg-sky-600 hover:bg-sky-700"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Generating...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Generate Report
          </span>
        )}
      </Button>

      {/* Report Display */}
      {report && !report.error && (
        <div className="space-y-3">
          {/* Safety Score */}
          <div className={cn(
            "p-4 rounded-lg border",
            report.summary.safety_score >= 80 
              ? "bg-green-500/10 border-green-500/30" 
              : report.summary.safety_score >= 50 
              ? "bg-yellow-500/10 border-yellow-500/30"
              : "bg-red-500/10 border-red-500/30"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className={cn(
                  "w-6 h-6",
                  report.summary.safety_score >= 80 ? "text-green-400" :
                  report.summary.safety_score >= 50 ? "text-yellow-400" : "text-red-400"
                )} />
                <div>
                  <p className="text-white font-bold">{report.summary.safety_score.toFixed(0)}/100</p>
                  <p className="text-xs text-zinc-400">Safety Score</p>
                </div>
              </div>
              <span className={cn(
                "px-2 py-1 rounded text-xs font-medium",
                report.rating === "Excellent" ? "bg-green-500/20 text-green-400" :
                report.rating === "Good" ? "bg-sky-500/20 text-sky-400" :
                report.rating === "Fair" ? "bg-yellow-500/20 text-yellow-400" :
                "bg-red-500/20 text-red-400"
              )}>
                {report.rating}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-zinc-900/50 border border-zinc-800 p-2 rounded">
              <p className="text-zinc-500 text-xs">Trips</p>
              <p className="text-white font-medium">{report.summary.total_trips}</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 p-2 rounded">
              <p className="text-zinc-500 text-xs">Distance</p>
              <p className="text-white font-medium">{report.summary.total_distance_miles} mi</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 p-2 rounded">
              <p className="text-zinc-500 text-xs">Safe Trips</p>
              <p className="text-green-400 font-medium">{report.summary.safe_trip_percentage}%</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 p-2 rounded">
              <p className="text-zinc-500 text-xs">Total Alerts</p>
              <p className={cn(
                "font-medium",
                report.summary.total_alerts > 0 ? "text-orange-400" : "text-green-400"
              )}>{report.summary.total_alerts}</p>
            </div>
          </div>

          {/* Download Button */}
          <Button
            onClick={downloadReport}
            variant="outline"
            className="w-full border-zinc-700 hover:bg-zinc-800"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Report (JSON)
          </Button>

          <p className="text-xs text-zinc-500 text-center">
            Share with your insurance for potential discounts
          </p>
        </div>
      )}

      {report?.error && (
        <div className="text-center py-4 text-zinc-400 text-sm">
          {report.error}
        </div>
      )}
    </div>
  );
}
