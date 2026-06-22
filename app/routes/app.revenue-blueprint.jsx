import { useEffect, useState } from "react";
import EmptyWorkspaceState from "../components/EmptyWorkspaceState";
import {
  API_BASE,
  getSelectedShopId,
  getAuthHeaders,
  isDemoAccount,
} from "../lib/accountContext";

export const meta = () => {
  return [{ title: "Revenue Blueprint | BluePrintAI" }];
};

function getSafeShopId() {
  if (typeof window === "undefined") return "1";
  return getSelectedShopId();
}

function getSafeDemoAccount() {
  if (typeof window === "undefined") return false;
  return isDemoAccount();
}

export default function RevenueBlueprintRoute() {
  const [blueprint, setBlueprint] = useState(null);
  const [shopState, setShopState] = useState(null);
  const [shopId, setShopId] = useState("1");
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setShopId(getSafeShopId());
    setDemo(getSafeDemoAccount());
  }, []);

  useEffect(() => {
    if (!shopId) return;

    async function load() {
      try {
        setLoading(true);

        if (!demo) {
          const stateRes = await fetch(
            `${API_BASE}/personalized/shop-state?shop_id=${encodeURIComponent(
              shopId
            )}`,
            {
              headers: getAuthHeaders(),
            }
          );

          if (stateRes.ok) {
            const state = await stateRes.json();
            setShopState(state);
          }
        }

        const res = await fetch(
          `${API_BASE}/blueprint/${encodeURIComponent(shopId)}/latest`,
          {
            headers: getAuthHeaders(),
          }
        );

        if (res.ok) {
          const data = await res.json();
          setBlueprint(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [demo, shopId]);

  async function generateBlueprint() {
    try {
      setGenerating(true);

      const res = await fetch(`${API_BASE}/blueprint/generate`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ shop_id: shopId }),
      });

      const data = await res.json();
      setBlueprint(data);
    } catch (err) {
      console.error("Failed to generate blueprint:", err);
    } finally {
      setGenerating(false);
    }
  }

  const newEmptyAccount = !demo && !shopState?.has_data && !blueprint;

  return (
    <div className="space-y-8">
      <div className="glass-strong rounded-2xl p-8">
        <p className="text-primary uppercase tracking-[0.18em] font-semibold text-xs">
          AI Growth Plan
        </p>

        <h1 className="font-display text-4xl font-semibold mt-3 text-foreground">
          Revenue Blueprint
        </h1>

        <p className="text-muted-foreground mt-3 text-sm sm:text-[15px]">
          A shop-specific plan based on this account’s data.
        </p>
      </div>

      {loading && <p className="text-muted-foreground">Loading blueprint...</p>}

      {!loading && newEmptyAccount && (
        <EmptyWorkspaceState
          title="No blueprint yet"
          description="This new shop does not have enough data for a strong revenue blueprint yet. Upload creatives or connect shop data first."
          primaryText="Upload Creative"
          primaryLink="/app/video-analysis"
        />
      )}

      {!loading && !newEmptyAccount && !blueprint && (
        <div className="glass rounded-2xl p-8">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            Generate your first blueprint
          </h2>

          <p className="text-muted-foreground mt-3 text-sm">
            This will create a shop-specific growth plan.
          </p>

          <button
            type="button"
            onClick={generateBlueprint}
            disabled={generating}
            className="mt-7 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Blueprint"}
          </button>
        </div>
      )}

      {!loading && blueprint && (
        <div className="glass rounded-2xl p-8">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            {blueprint.title || "AI Growth Blueprint"}
          </h2>

          <p className="text-muted-foreground mt-4 text-sm">
            {blueprint.summary ||
              blueprint.diagnosis ||
              "Your blueprint is ready."}
          </p>

          <button
            type="button"
            onClick={generateBlueprint}
            disabled={generating}
            className="mt-7 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate New Blueprint"}
          </button>

          <div className="space-y-5 mt-8">
            {(blueprint.steps || []).map((step, index) => (
              <div
                key={step.id || index}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6"
              >
                <p className="text-cyan-300 font-black">
                  Step {step.step_number || index + 1}
                </p>

                <h3 className="text-2xl font-black mt-2">
                  {step.title}
                </h3>

                <p className="text-slate-400 mt-3">
                  {step.description || step.action}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
