/* eslint-disable react/prop-types */
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import {
  buildRecommendations,
  buildRevenueBlueprint,
  findProduct,
  findRevenueBlueprint,
  loadTimelineCompletion,
  listRevenueBlueprints,
  loadMerchantData,
  saveRevenueBlueprintRecord,
  updateTimelineCompletion,
} from "../models/blueprint.server";
import { Icon } from "../components/blueprint-ui";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const merchantData = await loadMerchantData(admin, session);
  const savedBlueprints = await listRevenueBlueprints(session.shop);
  const requestedBlueprint = await findRevenueBlueprint(session.shop, url.searchParams.get("blueprintId"));
  const latestSaved = requestedBlueprint || savedBlueprints[0];
  const recommendationContext = buildRecommendationContext(merchantData, url.searchParams);
  const fallbackBlueprint = withBlueprintMeta(
    buildRevenueBlueprint(merchantData, recommendationContext),
    {
      blueprintId: "preview",
      generatedAt: new Date().toISOString(),
      version: "Preview",
    },
  );
  const blueprint = latestSaved
    ? withBlueprintMeta(latestSaved.payload, {
        blueprintId: latestSaved.id,
        generatedAt: latestSaved.payload?.generatedAt || latestSaved.createdAt,
      })
    : fallbackBlueprint;
  const blueprintKey = blueprintKeyFor(blueprint);

  return {
    merchantData,
    blueprint,
    blueprintKey,
    contextWarning:
      url.searchParams.get("blueprintId") && !requestedBlueprint
        ? "That saved blueprint could not be found, so the latest available plan is shown."
        : recommendationContext.warning,
    savedBlueprints,
    completion: await loadTimelineCompletion(session.shop, blueprintKey),
  };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const merchantData = await loadMerchantData(admin, session);
  const intent = formData.get("intent");
  const savedBlueprints = await listRevenueBlueprints(session.shop);

  if (intent === "toggle_step") {
    const completion = await updateTimelineCompletion(
      session.shop,
      String(formData.get("blueprintKey") || "legacy"),
      String(formData.get("actionId") || ""),
      formData.get("completed") !== "true",
    );

    return { completion, message: "Timeline item updated." };
  }

  if (intent === "export_calendar") {
    const blueprint = parseBlueprintFormValue(formData.get("blueprintJson"));

    if (!blueprint?.sevenDayPlan?.length) {
      return {
        error: "No displayed blueprint was available to export.",
      };
    }

    return new Response(buildCalendarExport(blueprint), {
      headers: {
        "Content-Disposition": `attachment; filename="${calendarFileName(blueprint)}"`,
        "Content-Type": "text/calendar; charset=utf-8",
      },
    });
  }

  const recommendationContext = buildRecommendationContextFromForm(merchantData, formData);
  const blueprint = {
    ...buildRevenueBlueprint(merchantData, recommendationContext),
    generatedAt: new Date().toISOString(),
    version: savedBlueprints.length + 1,
  };

  const savedBlueprint = await saveRevenueBlueprintRecord(session.shop, blueprint);
  const savedPayload = withBlueprintMeta(blueprint, {
    blueprintId: savedBlueprint.id,
    generatedAt: savedBlueprint.createdAt,
  });

  return {
    savedBlueprintId: savedBlueprint.id,
    savedAt: savedBlueprint.createdAt,
    blueprint: savedPayload,
    blueprintKey: blueprintKeyFor(savedPayload),
  };
};

export default function RevenueBlueprint() {
  const {
    merchantData,
    blueprint: loaderBlueprint,
    savedBlueprints,
    completion: loaderCompletion,
    blueprintKey: loaderBlueprintKey,
    contextWarning,
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const blueprint = actionData?.blueprint || loaderBlueprint;
  const blueprintKey = actionData?.blueprintKey || loaderBlueprintKey || blueprintKeyFor(blueprint);
  const completion = actionData?.completion || loaderCompletion || {};
  const isSubmitting = navigation.state === "submitting";
  const createdAt =
    blueprint.generatedAt ||
    merchantData.orders[0]?.createdAt ||
    merchantData.products[0]?.updatedAt ||
    new Date().toISOString();
  const metrics = [
    {
      label: "Products in scope",
      value: merchantData.products.length,
      icon: "product",
      tone: "primary",
    },
    {
      label: "Plan horizon",
      value: "7",
      unit: "days",
      icon: "calendar",
      tone: "primary",
    },
  ];
  const days = buildTimeline(blueprint.sevenDayPlan, completion);
  const blueprintJson = JSON.stringify(blueprint);

  return (
    <div className="bp-page bp-revenue-page">
      <header className="bp-revenue-header">
        <div>
          <p className="bp-revenue-eyebrow">Revenue Blueprint</p>
          <h1>7-day action plan</h1>
          <p>
            A focused weekly plan for the next creative and conversion moves.
          </p>
          <div className="bp-revenue-status-row">
            <span className="bp-revenue-status bp-revenue-status-ready">
              <Icon name="check" /> Plan ready
            </span>
            <span className="bp-revenue-generated">
              Generated {formatDateTime(createdAt)}
              {blueprint.version ? ` · Version ${blueprint.version}` : ""}
            </span>
          </div>
        </div>
        <Form method="post">
          <input type="hidden" name="productId" value={blueprint.context?.productId || ""} />
          <input type="hidden" name="recommendationId" value={blueprint.context?.recommendationId || ""} />
          <button
            className="bp-revenue-generate"
            type="submit"
            name="intent"
            value="generate"
          >
            <Icon name="sparkles" /> {isSubmitting ? "Generating..." : "Generate new blueprint"}
          </button>
        </Form>
      </header>

      <div className="bp-revenue-stack">
        {actionData?.savedBlueprintId && (
          <div className="bp-revenue-warning">
            <Icon name="check" />
            <p>
              <strong>Blueprint saved.</strong> This 7-day plan is stored in
              the workspace history for this shop.
            </p>
          </div>
        )}

        {actionData?.message && (
          <div className="bp-revenue-warning">
            <Icon name="check" />
            <p>{actionData.message}</p>
          </div>
        )}

        {(contextWarning || actionData?.error) && (
          <div className="bp-revenue-warning">
            <Icon name="warning" />
            <p>{actionData?.error || contextWarning}</p>
          </div>
        )}

        {blueprint.context?.generatedFor && (
          <div className="bp-revenue-warning bp-revenue-context">
            <Icon name="product" />
            <p>
              <strong>Acting on:</strong> {blueprint.context.generatedFor}
              {blueprint.context.recommendationTitle
                ? ` · ${blueprint.context.recommendationTitle}`
                : ""}
            </p>
          </div>
        )}

        {!merchantData.orderScopeEnabled && (
          <div className="bp-revenue-warning">
            <Icon name="warning" />
            <p>
              <strong>Catalog-only mode.</strong> Your order scope isn&apos;t enabled
              — this plan uses catalog signals only. Enable <code>read_orders</code>{" "}
              in Settings to unlock order-aware priorities.
            </p>
          </div>
        )}

        <div className="bp-revenue-metrics">
          {metrics.map((metric) => (
            <article
              className="bp-revenue-metric"
              data-tone={metric.tone}
              key={metric.label}
            >
              <div>
                <p>{metric.label}</p>
                <span>
                  <Icon name={metric.icon} />
                </span>
              </div>
              <strong>
                {metric.value}
                {metric.unit && <small>{metric.unit}</small>}
              </strong>
            </article>
          ))}
        </div>

        <RevenueSection title="Summary" icon="activity" elevated>
          <p className="bp-revenue-copy">{blueprint.diagnosis}</p>
        </RevenueSection>

        <div className="bp-revenue-two-col">
          <RevenueSection title="Top priorities" icon="list">
            <ol className="bp-revenue-priorities">
              {blueprint.priorities.map((priority, index) => (
                <li key={priority}>
                  <span>{index + 1}</span>
                  <p>{priority}</p>
                </li>
              ))}
            </ol>
          </RevenueSection>

          <RevenueSection title="Conversion ideas" icon="zap">
            <ul className="bp-revenue-dot-list">
              {blueprint.conversionIdeas.map((idea) => (
                <li key={idea}>{idea}</li>
              ))}
            </ul>
          </RevenueSection>
        </div>

        <RevenueSection
          title="Next 7 days"
          description="Daily focus and actions — check items off as you ship."
          icon="calendar"
          action={
            <Form method="post">
              <input type="hidden" name="blueprintJson" value={blueprintJson} />
              <button type="submit" name="intent" value="export_calendar">
                Export to calendar
              </button>
            </Form>
          }
        >
          <Timeline days={days} isSubmitting={isSubmitting} blueprintKey={blueprintKey} />
        </RevenueSection>

        <details className="bp-revenue-details">
          <summary>Supporting detail</summary>
          <div className="bp-revenue-positioning-grid">
            <RevenueSection title="Product positioning" icon="filter">
              <p className="bp-revenue-copy">{blueprint.positioning}</p>
            </RevenueSection>

            <RevenueSection title="Ad creative plan" icon="video">
              <ul className="bp-revenue-plan-grid">
                {blueprint.creativePlan.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </RevenueSection>
          </div>
        </details>

        {savedBlueprints.length > 0 && (
          <details className="bp-revenue-details">
            <summary>Saved blueprints</summary>
            <RevenueSection title="Saved blueprints" icon="save">
              <ul className="bp-revenue-dot-list">
                {savedBlueprints.map((item) => (
                  <li key={item.id}>
                    <a href={`/app/revenue-blueprint?blueprintId=${encodeURIComponent(item.id)}`}>
                      Saved {formatDateTime(item.createdAt)}
                    </a>
                  </li>
                ))}
              </ul>
            </RevenueSection>
          </details>
        )}
      </div>
    </div>
  );
}

function RevenueSection({
  title,
  description,
  icon,
  action,
  children,
  elevated = false,
}) {
  return (
    <section className={elevated ? "bp-revenue-section bp-revenue-section-elevated" : "bp-revenue-section"}>
      <header>
        <div>
          <span className="bp-revenue-section-icon">
            <Icon name={icon} />
          </span>
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
        </div>
        {action && <div className="bp-revenue-section-action">{action}</div>}
      </header>
      <div className="bp-revenue-section-body">{children}</div>
    </section>
  );
}

function Timeline({ days, isSubmitting, blueprintKey }) {
  return (
    <ol className="bp-revenue-timeline">
      {days.map((day) => {
        const done = day.actions.filter((action) => action.done).length;
        const complete = done === day.actions.length && day.actions.length > 0;

        return (
          <li key={day.day} className={complete ? "bp-revenue-day bp-revenue-day-complete" : "bp-revenue-day"}>
            <span className="bp-revenue-day-marker">D{day.day}</span>
            <article>
              <div className="bp-revenue-day-top">
                <div>
                  <p>{day.label}</p>
                  <h3>{day.focus}</h3>
                </div>
                <span>
                  {done}/{day.actions.length} done
                </span>
              </div>
              <ul>
                {day.actions.map((action) => (
                  <li key={action.id} className={action.done ? "is-done" : ""}>
                    <Form method="post" className="bp-revenue-step-form">
                      <input type="hidden" name="intent" value="toggle_step" />
                      <input type="hidden" name="blueprintKey" value={blueprintKey} />
                      <input type="hidden" name="actionId" value={action.id} />
                      <input type="hidden" name="completed" value={String(action.done)} />
                      <button type="submit" disabled={isSubmitting}>
                        <span aria-hidden="true" />
                        {action.text}
                      </button>
                    </Form>
                  </li>
                ))}
              </ul>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

function buildTimeline(steps, completion = {}) {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const focuses = [
    "Brief & approve",
    "Shoot day",
    "Edit & QA",
    "Ship to ad set",
    "PDP fixes",
    "Monitor",
    "Review & plan",
  ];

  return steps.map((step, index) => ({
    day: index + 1,
    label: labels[index] || `Day ${index + 1}`,
    focus: focuses[index] || `Day ${index + 1}`,
    actions: splitStep(step, index, completion),
  }));
}

function splitStep(step, dayIndex, completion = {}) {
  const text = step.replace(/^Day\s+\d+:\s*/i, "");
  const extras = [
    ["Approve the strongest product angle", "Brief the next product concept"],
    ["QA the opening five seconds"],
    ["Match landing-page copy to the ad hook"],
    ["Log clarity, CTA, pacing, and proof notes"],
    ["Send the highest-confidence brief to production"],
    ["Choose one priority test for next week"],
    ["Generate fresh Blueprint"],
  ];

  return [text, ...(extras[dayIndex] || [])].slice(0, dayIndex < 2 ? 3 : 2).map((action, index) => ({
    id: `d${dayIndex + 1}a${index + 1}`,
    text: action,
    done:
      typeof completion[`d${dayIndex + 1}a${index + 1}`] === "boolean"
        ? completion[`d${dayIndex + 1}a${index + 1}`]
        : dayIndex === 0
          ? index < 2
          : dayIndex === 1
            ? index === 0
            : false,
  }));
}

function buildRecommendationContext(merchantData, searchParams) {
  const productId = searchParams.get("productId");
  const recommendationId = searchParams.get("recommendationId");
  const product = productId ? findProduct(merchantData.products, productId) : merchantData.products[0];
  const recommendations = buildRecommendations(merchantData.products, merchantData.orders);
  const recommendation = recommendations.find((item) => item.id === recommendationId);

  if (!productId && !recommendationId) return {};

  return {
    product,
    recommendation,
    warning: recommendationId && !recommendation
      ? "That recommendation could not be found, so the blueprint is using product context only."
      : "",
  };
}

function buildRecommendationContextFromForm(merchantData, formData) {
  const params = new URLSearchParams();
  const productId = String(formData.get("productId") || "");
  const recommendationId = String(formData.get("recommendationId") || "");

  if (productId) params.set("productId", productId);
  if (recommendationId) params.set("recommendationId", recommendationId);

  return buildRecommendationContext(merchantData, params);
}

function withBlueprintMeta(blueprint, meta = {}) {
  return {
    ...blueprint,
    blueprintId: meta.blueprintId || blueprint?.blueprintId || null,
    generatedAt: meta.generatedAt || blueprint?.generatedAt || new Date().toISOString(),
    version: blueprint?.version || meta.version || null,
  };
}

function blueprintKeyFor(blueprint) {
  return String(
    blueprint?.blueprintId ||
      [blueprint?.generatedAt, blueprint?.version, blueprint?.context?.productId, blueprint?.context?.recommendationId]
        .filter(Boolean)
        .join(":") ||
      "preview",
  );
}

function parseBlueprintFormValue(value) {
  if (!value) return null;

  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function calendarFileName(blueprint) {
  const key = String(blueprint?.blueprintId || blueprint?.version || "current")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");

  return `blueprint-${key || "current"}-7-day-plan.ics`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildCalendarExport(blueprint) {
  const now = new Date();
  const stamp = toCalendarDateTime(now);
  const start = new Date(now);
  start.setDate(start.getDate() + 1);

  const events = blueprint.sevenDayPlan.map((step, index) => {
    const eventDate = new Date(start);
    eventDate.setDate(start.getDate() + index);
    const eventEnd = new Date(eventDate);
    eventEnd.setHours(eventEnd.getHours() + 1);

    return [
      "BEGIN:VEVENT",
      `UID:blueprintai-${blueprint.blueprintId || blueprint.version || "current"}-${index + 1}-${stamp}@blueprintai`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toCalendarDateTime(eventDate)}`,
      `DTEND:${toCalendarDateTime(eventEnd)}`,
      `SUMMARY:BluePrintAI Day ${index + 1}${blueprint.context?.productTitle ? ` - ${blueprint.context.productTitle}` : ""}`,
      `DESCRIPTION:${escapeCalendarText([
        step,
        blueprint.blueprintId ? `Blueprint ID: ${blueprint.blueprintId}` : "",
        blueprint.version ? `Version: ${blueprint.version}` : "",
        blueprint.generatedAt ? `Generated: ${blueprint.generatedAt}` : "",
      ].filter(Boolean).join("\\n"))}`,
      "END:VEVENT",
    ].join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BluePrintAI//Revenue Blueprint//EN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

function toCalendarDateTime(value) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeCalendarText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
