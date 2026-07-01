import { Play } from "lucide-react";

function num(value) {
  return Number(value || 0);
}

function getCreativeImage(c) {
  return (
    c.screenshot_url ||
    c.screenshot ||
    c.thumbnail_url ||
    c.thumbnail ||
    c.image_url ||
    c.image ||
    c.preview_url ||
    null
  );
}

function getCreativeTitle(c) {
  return (
    c.title ||
    c.insight ||
    c.creative_name ||
    c.name ||
    c.product ||
    "Saved creative"
  );
}

function ScoreBar({ value }) {
  const score = Math.max(0, Math.min(100, num(value)));

  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] font-semibold text-white w-10 text-right">
        {score}%
      </span>
      <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-400"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export default function TopCreatives({ data }) {
  const creatives = (
    data?.top_creatives ||
    data?.topCreatives ||
    data?.leaderboard ||
    []
  ).slice(0, 8);

  return (
    <div className="bg-[#0d1526] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[14px] font-semibold text-white mb-0.5">
            Saved Creative Activity
          </h2>
          <p className="text-[11px] text-slate-500">
            Ranked by a directional heuristic from saved or imported records
          </p>
        </div>
      </div>

      {creatives.length === 0 ? (
        <p className="text-sm text-slate-500">
          Analyze a video or save a creative to populate your Command Center.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {["#", "Creative", "Source", "Heuristic signal", "Saved", "Next Step"].map((h) => (
                  <th
                    key={h}
                    className="pb-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider first:pl-0 pr-4 last:pr-0"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.03]">
              {creatives.map((c, index) => {
                const image = getCreativeImage(c);

                return (
                  <tr
                    key={c.id || c.creative_id || index}
                    className="group hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <span className="text-[12px] font-bold text-slate-600 w-5 inline-block">
                        {index + 1}
                      </span>
                    </td>

                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="relative flex-shrink-0 w-12 h-12 rounded-lg bg-sky-500/15 overflow-hidden flex items-center justify-center">
                          {image ? (
                            <img
                              src={image}
                              alt={getCreativeTitle(c)}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Play size={13} className="text-sky-300 fill-sky-300" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <span className="text-[12px] font-medium text-slate-200 max-w-[210px] block truncate">
                            {getCreativeTitle(c)}
                          </span>
                          <span className="text-[10px] text-slate-600 max-w-[210px] block truncate">
                            {c.product || c.product_name || "No product saved"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 pr-4">
                      <div>
                        <p className="text-[11px] font-medium text-slate-300 leading-tight">
                          {c.source || c.sourceType || "Saved record"}
                        </p>
                        <p className="text-[10px] text-slate-600">
                          {c.creator || c.creator_name || "Manual/uploaded"}
                        </p>
                      </div>
                    </td>

                    <td className="py-3 pr-4">
                      <ScoreBar value={c.score || c.readiness} />
                    </td>

                    <td className="py-3 min-w-[120px]">
                      <span className="text-[12px] font-medium text-slate-300">
                        {c.savedAt
                          ? new Date(c.savedAt).toLocaleDateString()
                          : "Recently"}
                      </span>
                    </td>

                    <td className="py-3 min-w-[160px]">
                      <span className="text-[12px] font-medium text-slate-300">
                        {c.nextStep || "Review saved record"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-[11px] leading-5 text-slate-500">
        Heuristic signals summarize available workspace fields; they are not live platform scores, forecasts, or proof that one creative will outperform another.
      </p>
    </div>
  );
}
