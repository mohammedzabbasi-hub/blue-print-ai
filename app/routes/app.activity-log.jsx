import { useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  buildActivityEvents,
  listRevenueBlueprints,
  listSavedBriefs,
  listSavedCreatives,
  listVideoAnalyses,
  listWorkspaceRequests,
} from "../models/blueprint.server";

export const meta = () => {
  return [{ title: "Activity Log | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const [briefs, creatives, analyses, blueprints, requests] = await Promise.all([
    listSavedBriefs(session.shop, 50),
    listSavedCreatives(session.shop, 50),
    listVideoAnalyses(session.shop, 50),
    listRevenueBlueprints(session.shop, 50),
    listWorkspaceRequests(session.shop, 50),
  ]);

  return {
    events: buildActivityEvents({ briefs, creatives, analyses, blueprints, requests }),
  };
};

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "Brief", label: "Ad briefs" },
  { id: "Creative", label: "Creative library" },
  { id: "Analysis", label: "Video analysis" },
  { id: "Blueprint", label: "Revenue blueprint" },
  { id: "Workspace", label: "Workspace" },
];

export default function ActivityLogRoute() {
  const { events } = useLoaderData();
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((event) => event.type === filter);
  }, [events, filter]);

  return (
    <div className="space-y-8">
      <div>
        <div className="glass-strong rounded-2xl p-8 mb-8">
          <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
            Workspace History
          </p>

          <h1 className="font-display text-4xl font-semibold text-foreground mt-4">
            Activity Log
          </h1>

          <p className="text-muted-foreground mt-3 text-sm sm:text-[15px]">
            Real, saved workspace activity for this shop: ad briefs, saved
            creatives, video analyses, revenue blueprints, and workspace
            requests.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          {FILTERS.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`rounded-xl px-5 py-3 font-bold ${
                filter === item.id
                  ? "bg-cyan-500 text-white"
                  : "bg-[#0b1220] border border-slate-800 text-slate-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-8 text-slate-400">
            No activity yet. Generate a brief, save a creative, run a video
            analysis, or build a revenue blueprint to see it here.
          </div>
        )}

        <div className="space-y-5">
          {filtered.map((event) => (
            <a
              key={event.id}
              href={event.href}
              className="block rounded-2xl border border-slate-800 bg-[#0b1220] p-6 hover:border-cyan-700"
            >
              <div className="flex justify-between gap-4">
                <div>
                  <span className="inline-block rounded-full bg-cyan-950 px-4 py-1 text-cyan-300 text-sm font-bold">
                    {event.type}
                  </span>

                  <h2 className="text-2xl font-bold mt-4">{event.title}</h2>

                  <p className="text-slate-400 mt-3">{event.detail}</p>
                </div>

                <p className="text-slate-400 text-sm min-w-[180px] text-right">
                  {formatDate(event.createdAt)}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
