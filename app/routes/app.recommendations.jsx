import { useLoaderData } from "react-router";
import EmptyWorkspaceState from "../components/EmptyWorkspaceState";
import { authenticate } from "../shopify.server";
import { buildRecommendations, loadMerchantData } from "../models/blueprint.server";
import {
  buildImportedCreatives,
  buildImportedCreators,
} from "../models/importedData.server";

export const meta = () => {
  return [{ title: "Recommendations | BluePrintAI" }];
};

function buildImportedInsights(creatives, creators) {
  const insights = [];

  const creativesWithCtr = creatives.filter(
    (creative) => creative.ctr !== null && creative.ctr !== undefined,
  );

  if (creativesWithCtr.length) {
    const lowestCtrCreative = creativesWithCtr.reduce((lowest, creative) =>
      creative.ctr < lowest.ctr ? creative : lowest,
    );

    insights.push({
      id: `imported-lowest-ctr-${lowestCtrCreative.id}`,
      title: `Test a new hook for ${lowestCtrCreative.title}`,
      description: `${lowestCtrCreative.title} has a ${lowestCtrCreative.ctr.toFixed(
        1,
      )}% CTR, the lowest of your imported creatives — test a new hook.`,
    });
  }

  const creatorsWithRevenue = creators.filter(
    (creator) =>
      creator.totalRevenue !== null && creator.totalRevenue !== undefined,
  );

  if (creatorsWithRevenue.length) {
    const topRevenueCreator = creatorsWithRevenue.reduce((top, creator) =>
      Number(creator.totalRevenue) > Number(top.totalRevenue) ? creator : top,
    );

    insights.push({
      id: `imported-top-revenue-${topRevenueCreator.id}`,
      title: `Brief ${topRevenueCreator.name} for another concept`,
      description: `${topRevenueCreator.name} generated $${Number(
        topRevenueCreator.totalRevenue,
      ).toLocaleString("en-US")} in tracked revenue — brief them for another concept.`,
    });
  }

  return insights.slice(0, 3);
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const merchantData = await loadMerchantData(admin, session);
  const catalogRecommendations = buildRecommendations(
    merchantData.products,
    merchantData.orders,
  );

  const [importedCreatives, importedCreators] = await Promise.all([
    buildImportedCreatives(session.shop),
    buildImportedCreators(session.shop),
  ]);

  const importedInsights = buildImportedInsights(
    importedCreatives,
    importedCreators,
  );

  return {
    items: [...catalogRecommendations, ...importedInsights],
  };
};

export default function RecommendationsRoute() {
  const { items } = useLoaderData();

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

      {items.length === 0 && (
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
              {item.title || "Recommendation"}
            </h2>

            <p className="text-muted-foreground mt-3 text-sm">
              {item.description || item.detail || item.nextAction || ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
