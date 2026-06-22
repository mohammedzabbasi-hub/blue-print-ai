import { useEffect, useMemo, useState } from "react";
import { clearActivityLog, getActivityLog } from "../services/activityLog";

export const meta = () => {
  return [{ title: "Activity Log | BluePrintAI" }];
};

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function ActivityLogRoute() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadLogs() {
    try {
      setLoading(true);
      setError("");

      const data = await getActivityLog({
        activity_type: filter,
      });

      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load activity log:", err);
      setError("Could not load activity log.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [filter]);

  const filters = useMemo(
    () => [
      "all",
      "video_analysis",
      "blueprint",
      "ad_brief",
      "recommendation",
      "shop_connection",
    ],
    []
  );

  async function handleClear() {
    try {
      await clearActivityLog();
      setLogs([]);
    } catch (err) {
      console.error("Failed to clear activity log:", err);
      setError("Could not clear activity log.");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="glass-strong rounded-2xl p-8 mb-8">
          <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
            Workspace History
          </p>

          <div className="flex items-center justify-between gap-4 mt-4">
            <div>
              <h1 className="font-display text-4xl font-semibold text-foreground">
                Activity Log
              </h1>

              <p className="text-muted-foreground mt-3 text-sm sm:text-[15px]">
                Track video analyses, ad briefs, blueprint generations, saved
                creatives, and shop connections.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClear}
              className="rounded-xl border border-red-500/40 bg-red-950/40 px-6 py-3 text-red-100 font-semibold"
            >
              Clear Log
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          {filters.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-xl px-5 py-3 font-bold ${
                filter === item
                  ? "bg-cyan-500 text-white"
                  : "bg-[#0b1220] border border-slate-800 text-slate-300"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {loading && <p className="text-slate-400">Loading activity...</p>}

        {error && <p className="text-red-300">{error}</p>}

        {!loading && logs.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-8 text-slate-400">
            No activity yet.
          </div>
        )}

        <div className="space-y-5">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-2xl border border-slate-800 bg-[#0b1220] p-6"
            >
              <div className="flex justify-between gap-4">
                <div>
                  <span className="inline-block rounded-full bg-cyan-950 px-4 py-1 text-cyan-300 text-sm font-bold">
                    {log.activity_type}
                  </span>

                  <h2 className="text-2xl font-bold mt-4">{log.title}</h2>

                  <p className="text-slate-400 mt-3">{log.description}</p>

                  <p className="text-slate-500 mt-4 text-sm">
                    User: {log.user_name || "Unknown"} ·{" "}
                    {log.user_email || "No email"}
                    {log.shop_id ? ` · Shop ID: ${log.shop_id}` : ""}
                  </p>
                </div>

                <p className="text-slate-400 text-sm min-w-[180px] text-right">
                  {formatDate(log.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
