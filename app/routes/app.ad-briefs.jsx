import { useEffect, useState } from "react";
import EmptyWorkspaceState from "../components/EmptyWorkspaceState";
import {
  API_BASE,
  getAuthHeaders,
  getSelectedShopId,
} from "../lib/accountContext";

export const meta = () => {
  return [{ title: "Ad Briefs | BluePrintAI" }];
};

function formatBriefDescription(brief) {
  if (brief.description || brief.content || brief.summary) {
    return brief.description || brief.content || brief.summary;
  }

  if (brief.structure) return brief.structure;

  if (Array.isArray(brief.script)) {
    return brief.script
      .map((scene) => scene.direction || scene.goal)
      .filter(Boolean)
      .join(" ");
  }

  if (brief.hook_type || brief.creator_type || brief.visual_style) {
    return [brief.hook_type, brief.creator_type, brief.visual_style]
      .filter(Boolean)
      .join(" · ");
  }

  return "";
}

export default function AdBriefsRoute() {
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const shopId = getSelectedShopId();

  useEffect(() => {
    async function load() {
      const res = await fetch(`${API_BASE}/briefs?shop_id=${shopId}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      setBriefs(Array.isArray(data) ? data : data.briefs || []);
      setLoading(false);
    }

    load().catch((err) => {
      console.error(err);
      setBriefs([]);
      setLoading(false);
    });
  }, [shopId]);

  return (
    <div className="space-y-8">
      <div className="glass-strong rounded-2xl p-8">
        <p className="text-primary uppercase tracking-[0.18em] font-semibold text-xs">
          Creative Planning
        </p>

        <h1 className="font-display text-4xl font-semibold mt-3 text-foreground">
          Ad Briefs
        </h1>

        <p className="text-muted-foreground mt-3 text-sm sm:text-[15px]">
          Briefs generated from this shop’s real creative patterns.
        </p>
      </div>

      {loading && <p className="text-muted-foreground">Loading briefs...</p>}

      {!loading && briefs.length === 0 && (
        <EmptyWorkspaceState
          title="No ad briefs yet"
          description="This shop does not have enough creative data to generate personalized ad briefs yet. Upload or analyze creatives first."
          primaryText="Upload Creative"
          primaryLink="/app/video-analysis"
        />
      )}

      <div className="space-y-6">
        {briefs.map((brief, index) => (
          <div key={brief.id || index} className="glass rounded-2xl p-5">
            <h2 className="font-display text-2xl font-semibold text-foreground">
              {brief.title || brief.brief_title || "Ad Brief"}
            </h2>

            <p className="text-muted-foreground mt-3 text-sm">
              {formatBriefDescription(brief)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
