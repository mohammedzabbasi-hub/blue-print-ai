import { useActionData, useLoaderData, useNavigation, Form } from "react-router";
import EmptyWorkspaceState from "../components/EmptyWorkspaceState";
import { authenticate } from "../shopify.server";
import {
  buildRevenueBlueprint,
  listRevenueBlueprints,
  loadMerchantData,
  saveRevenueBlueprintRecord,
} from "../models/blueprint.server";

export const meta = () => {
  return [{ title: "Revenue Blueprint | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const merchantData = await loadMerchantData(admin, session);
  const savedBlueprints = await listRevenueBlueprints(session.shop, 1);
  const latestBlueprint = savedBlueprints[0] || null;

  return {
    merchantData,
    blueprint: latestBlueprint ? latestBlueprint.payload : null,
  };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "generate") {
    const merchantData = await loadMerchantData(admin, session);
    const blueprint = buildRevenueBlueprint(merchantData);
    await saveRevenueBlueprintRecord(session.shop, blueprint);

    return { blueprint };
  }

  return { blueprint: null };
};

export default function RevenueBlueprintRoute() {
  const { merchantData, blueprint: loaderBlueprint } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isGenerating =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "generate";

  const blueprint = actionData?.blueprint || loaderBlueprint;
  const hasCatalogData = merchantData.products.length > 0;
  const newEmptyAccount = !hasCatalogData && !blueprint;

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

      {newEmptyAccount && (
        <EmptyWorkspaceState
          title="No blueprint yet"
          description="This new shop does not have enough data for a strong revenue blueprint yet. Upload creatives or connect shop data first."
          primaryText="Upload Creative"
          primaryLink="/app/video-analysis"
        />
      )}

      {!newEmptyAccount && !blueprint && (
        <div className="glass rounded-2xl p-8">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            Generate your first blueprint
          </h2>

          <p className="text-muted-foreground mt-3 text-sm">
            This will create a shop-specific growth plan.
          </p>

          <Form method="post">
            <input type="hidden" name="intent" value="generate" />
            <button
              type="submit"
              disabled={isGenerating}
              className="mt-7 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "Generate Blueprint"}
            </button>
          </Form>
        </div>
      )}

      {blueprint && (
        <div className="glass rounded-2xl p-8">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            AI Growth Blueprint
          </h2>

          <p className="text-muted-foreground mt-4 text-sm">
            {blueprint.diagnosis || "Your blueprint is ready."}
          </p>

          <Form method="post">
            <input type="hidden" name="intent" value="generate" />
            <button
              type="submit"
              disabled={isGenerating}
              className="mt-7 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "Generate New Blueprint"}
            </button>
          </Form>

          {blueprint.positioning && (
            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
              <p className="text-cyan-300 font-black">Positioning</p>
              <p className="text-slate-400 mt-3">{blueprint.positioning}</p>
            </div>
          )}

          {Array.isArray(blueprint.priorities) && blueprint.priorities.length > 0 && (
            <div className="mt-6">
              <h3 className="font-display text-xl font-semibold text-foreground">
                Priorities
              </h3>

              <ul className="space-y-3 mt-4">
                {blueprint.priorities.map((priority, index) => (
                  <li
                    key={index}
                    className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-slate-400"
                  >
                    {priority}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(blueprint.conversionIdeas) && blueprint.conversionIdeas.length > 0 && (
            <div className="mt-6">
              <h3 className="font-display text-xl font-semibold text-foreground">
                Conversion ideas
              </h3>

              <ul className="space-y-3 mt-4">
                {blueprint.conversionIdeas.map((idea, index) => (
                  <li
                    key={index}
                    className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-slate-400"
                  >
                    {idea}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(blueprint.creativePlan) && blueprint.creativePlan.length > 0 && (
            <div className="mt-6">
              <h3 className="font-display text-xl font-semibold text-foreground">
                Creative plan
              </h3>

              <ul className="space-y-3 mt-4">
                {blueprint.creativePlan.map((item, index) => (
                  <li
                    key={index}
                    className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-slate-400"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(blueprint.sevenDayPlan) && blueprint.sevenDayPlan.length > 0 && (
            <div className="mt-8">
              <h3 className="font-display text-xl font-semibold text-foreground">
                7-day plan
              </h3>

              <div className="space-y-5 mt-4">
                {blueprint.sevenDayPlan.map((step, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6"
                  >
                    <p className="text-cyan-300 font-black">Step {index + 1}</p>

                    <p className="text-slate-400 mt-3">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
