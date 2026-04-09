"use client";

import { useState } from "react";
import { logPersonalPerformance } from "@/server/actions/performance";

interface PerformanceHistoryItem {
  id: string;
  kpiName: string;
  value: number;
  date: string;
}

interface PerformanceFormProps {
  initialData: {
    recentLogs: PerformanceHistoryItem[];
    availableKpis: Array<{ id: string; name: string; unit: string | null }>;
  };
}

export default function PerformanceForm({ initialData }: PerformanceFormProps) {
  const [data, setData] = useState(initialData);
  const [selectedKpi, setSelectedKpi] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKpi || !value) return;

    setLoading(true);
    try {
      await logPersonalPerformance({
        trackerKpiId: selectedKpi,
        value: parseFloat(value),
      });

      setValue("");
      // Force refresh to show new data from server
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Failed to log performance.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-grid">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Log performance</h3>
            <p className="muted">Enter daily stats for active trackers.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <select 
            className="input" 
            value={selectedKpi} 
            onChange={(e) => setSelectedKpi(e.target.value)}
            disabled={loading}
          >
            <option value="">Select a tracker...</option>
            {data.availableKpis.map((kpi) => (
              <option key={kpi.id} value={kpi.id}>{kpi.name} ({kpi.unit})</option>
            ))}
          </select>

          <input 
            type="number" 
            step="0.01" 
            className="input" 
            placeholder="Value" 
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={loading}
          />

          <button 
            type="submit" 
            className="button button-primary"
            disabled={loading || !selectedKpi || !value}
          >
            {loading ? "Logging..." : "Log values"}
          </button>
        </form>
      </section>

      <section className="card dashboard-span">
        <div className="section-header">
          <div>
             <h3>Recent history</h3>
             <p className="muted">Your latest five performance records.</p>
          </div>
        </div>
        
        <div className="stack-list">
          {data.recentLogs.length === 0 ? (
            <p className="muted">No logs recorded yet.</p>
          ) : (
            data.recentLogs.map((log) => (
              <div key={log.id} className="stack-item">
                <div>
                  <strong>{log.kpiName}</strong>
                  <p className="muted">Logged on {new Date(log.date).toLocaleString()}</p>
                </div>
                <div style={{ textAlign: "right", fontSize: "1.2rem", fontWeight: 700 }}>
                   {log.value}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
