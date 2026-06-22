import { Flame, TrendingUp, Users, Zap } from "lucide-react";
import { useNavigate } from "react-router";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function setStorageItem(key, value) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, value);
}

function getLeaderboard(data) {
  return data?.leaderboard || data?.top_creatives || [];
}

function getTopProduct(data) {
  const creative = getLeaderboard(data)[0];
  return creative?.product || creative?.product_name || "";
}

function getShopName(data) {
  return data?.shop?.shop_name || data?.shop?.name || "Your Shop";
}

function topPattern(patternMap) {
  return Object.entries(patternMap || {})
    .map(([label, count]) => [label, Number(count || 0)])
    .filter(([label, count]) => label && count > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function buildActions(data, handlers) {
  const leaderboard = data?.leaderboard || data?.top_creatives || [];
  const topCreative = leaderboard[0] || null;
  const topProduct = getTopProduct(data);
  const topHook = topPattern(data?.patterns?.hooks);
  const topCreatorType = topPattern(data?.patterns?.creator_types);
  const productPhrase = topProduct ? ` for ${topProduct}` : "";
  const actions = [];

  if (topHook) {
    actions.push({
      icon: Flame,
      title: `Scale ${topHook} creatives`,
      description: `Your connected shop shows ${topHook} as a leading hook pattern. Create 3 to 5 more variants using this opening angle${productPhrase}.`,
      priority: "High",
      actionLabel: "Generate Brief",
      color: "rose",
      onClick: handlers.goGenerateBrief,
    });
  }

  if (topCreatorType) {
    actions.push({
      icon: Users,
      title: `Recruit more ${topCreatorType} creators`,
      description: `${topCreatorType} creators are showing up in this shop's winning creative mix. Prioritize creators with similar delivery style.`,
      priority: "High",
      actionLabel: "Find Creators",
      color: "sky",
      onClick: handlers.goFindCreators,
    });
  }

  if (topCreative) {
    actions.push({
      icon: TrendingUp,
      title: "Turn the top creative into variants",
      description: `"${topCreative.title || topCreative.name || topCreative.product || "Top creative"}" is one of your top performers. Test new CTAs, new first 3 seconds, and a product-benefit version.`,
      priority: "Medium",
      actionLabel: "Create Variant",
      color: "emerald",
      onClick: handlers.goCreateVariant,
    });
  }

  return actions;
}

function ActionCard({ icon: Icon, title, description, priority, actionLabel, onClick, color = "sky" }) {
  const colorClasses = {
    rose: "bg-rose-500/15 text-rose-300",
    sky: "bg-sky-500/15 text-sky-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
  };

  const priorityClasses = {
    High: "bg-rose-500/15 text-rose-300",
    Medium: "bg-amber-500/15 text-amber-300",
    Low: "bg-emerald-500/15 text-emerald-300",
  };

  return (
    <div className="border border-white/10 rounded-2xl p-6 bg-[#0d1526]">
      <div className="flex items-start gap-5">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          <Icon size={22} />
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-xl font-bold text-white leading-tight">{title}</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${priorityClasses[priority]}`}>
              {priority}
            </span>
          </div>

          <p className="mt-3 text-slate-400 leading-relaxed">{description}</p>

          <button
            type="button"
            onClick={onClick}
            className="mt-5 text-sky-300 font-bold hover:text-sky-200 transition-colors"
          >
            {actionLabel} -&gt;
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NextActions({ data }) {
  const navigate = useNavigate();
  const topProduct = getTopProduct(data);
  const topCreative = getLeaderboard(data)[0] || null;

  function goGenerateBrief() {
    setStorageItem("briefProductName", topProduct);
    setStorageItem("briefBrandName", getShopName(data));
    navigate("/app/ad-briefs");
  }

  function goFindCreators() {
    setStorageItem("creatorSearchFocus", topProduct);
    navigate("/app/creators");
  }

  function goCreateVariant() {
    if (!topCreative) return;

    setStorageItem(
      "variantSourceCreative",
      JSON.stringify({
        product: topCreative.product || topCreative.product_name || topProduct,
        title: topCreative.title || topCreative.name || topCreative.product || "Top creative",
        hook_type: topCreative.hook_type || "",
        creator_type: topCreative.creator_type || "",
        recommendation: "Create a new hook, CTA, and product-benefit version from this top creative.",
      })
    );

    navigate("/app/revenue-blueprint");
  }

  const actions = buildActions(data, {
    goGenerateBrief,
    goFindCreators,
    goCreateVariant,
  });

  return (
    <div className="bg-[#0d1526] border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-sky-500/15 flex items-center justify-center text-sky-300">
          <Zap size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Recommended Actions</h2>
          <p className="text-slate-400">Generated from connected shop patterns</p>
        </div>
      </div>

      <div className="space-y-5">
        {actions.length === 0 && (
          <div className="border border-white/10 rounded-2xl p-6 bg-[#0d1526]">
            <p className="text-sm font-semibold text-slate-300">
              No recommended actions yet.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Import data or upload creatives to generate shop-specific next steps.
            </p>
          </div>
        )}

        {actions.map((action) => (
          <ActionCard key={action.title} {...action} />
        ))}
      </div>
    </div>
  );
}
