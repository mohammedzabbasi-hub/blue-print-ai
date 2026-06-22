import { useEffect, useState } from "react";
import EmptyWorkspaceState from "../components/EmptyWorkspaceState";
import {
  API_BASE,
  getAuthHeaders,
  getSelectedShopId,
  isDemoAccount,
} from "../lib/accountContext";

export const meta = () => {
  return [{ title: "Recommendations | BluePrintAI" }];
};

function getSafeShopId() {
  if (typeof window === "undefined") return "1";
  return getSelectedShopId();
}

function getSafeDemoAccount() {
  if (typeof window === "undefined") return false;
  return isDemoAccount();
}

export default function RecommendationsRoute() {
  const [items, setItems] = useState([]);
  const [shopId, setShopId] = useState("1");
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setShopId(getSafeShopId());
    setDemo(getSafeDemoAccount());
  }, []);

  useEffect(() => {
    if (!shopId) return;

    async function load() {
      const endpoint = demo
        ? `${API_BASE}/recommendations?shop_id=${encodeURIComponent(shopId)}`
        : `${API_BASE}/personalized/recommendations?shop_id=${encodeURIComponent(
            shopId
          )}`;

      const res = await fetch(endpoint, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      setItems(Array.isArray(data) ? data : data.recommendations || []);
      setLoading(false);
    }

    load().catch((err) => {
      console.error(err);
      setItems([]);
      setLoading(false);
    });
  }, [demo, shopId]);

  return (
    <div className="space-y-8">
      <div className="glass-strong rounded-2xl p-8">
        <p className="text-primary uppercase tracking-[0.18em] font-semibold text-xs">
          Growth Engine
        </p>

        <h1 className="font-display text-4xl font-semibold mt-3 text-foreground">
          Recommendations
        </h1>

        <p className="text-muted-foreground mt-3 text-sm sm:text-[15px]">
          Personalized recommendations based on this shop’s creative data.
        </p>
      </div>

      {loading && (
        <p className="text-muted-foreground">Loading recommendations...</p>
      )}

      {!loading && items.length === 0 && (
        <EmptyWorkspaceState
          title="No recommendations yet"
          description="Recommendations will appear after this shop has uploaded creatives, video analyses, or connected TikTok Shop performance data."
          primaryText="Analyze a Video"
          primaryLink="/app/video-analysis"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items.map((item, index) => (
          <div key={item.id || index} className="glass rounded-2xl p-5">
            <h2 className="font-display text-xl font-semibold text-foreground">
              {item.title ||
                item.name ||
                item.recommendation ||
                "Recommendation"}
            </h2>

            <p className="text-muted-foreground mt-3 text-sm">
              {item.description ||
                item.details ||
                item.reason ||
                item.action ||
                item.evidence ||
                ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
