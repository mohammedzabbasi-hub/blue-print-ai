import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";
import {
  clearActivityLogs,
  listActivityLogs,
} from "../models/blueprint.server";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { merchantErrorMessage } from "../utils/merchant-errors";

export const meta = () => {
  return [{ title: "Activity Log | BluePrintAI" }];
};

const FILTERS = [
  "all",
  "video_analysis",
  "creative",
  "creative_deleted",
  "blueprint",
  "ad_brief",
  "settings",
];

export const loader = async ({ request }) => {
  const { session } = await loadShopifyRouteContext(request);
  const url = new URL(request.url);
  const filter = FILTERS.includes(url.searchParams.get("type"))
    ? url.searchParams.get("type")
    : "all";
  const logs = await listActivityLogs(session.shop, { type: filter, limit: 100 });

  return {
    filter,
    logs: logs.map(toActivityCard),
    shop: session.shop,
  };
};

export const action = async ({ request }) => {
  const { session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent !== "clear") {
    return { error: "Unknown activity log action." };
  }

  try {
    await clearActivityLogs(session.shop);
    return { success: "Activity log cleared." };
  } catch (error) {
    return { error: merchantErrorMessage(error, "Could not clear activity log. Try again.") };
  }
};

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function ActivityLogRoute() {
  const { filter, logs, shop } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const clearing =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "clear";

  function selectFilter(nextFilter) {
    const next = new URLSearchParams(searchParams);

    if (nextFilter === "all") {
      next.delete("type");
    } else {
      next.set("type", nextFilter);
    }

    setSearchParams(next);
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
                Real activity records saved for {shop}.
              </p>
            </div>

            <Form method="post">
              <input name="intent" type="hidden" value="clear" />
              <button
                type="submit"
                disabled={clearing || logs.length === 0}
                className="rounded-xl border border-red-500/40 bg-red-950/40 px-6 py-3 text-red-100 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {clearing ? "Clearing..." : "Clear Log"}
              </button>
            </Form>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          {FILTERS.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => selectFilter(item)}
              className={`rounded-xl px-5 py-3 font-bold ${
                filter === item
                  ? "bg-cyan-500 text-white"
                  : "bg-[#0b1220] border border-slate-800 text-slate-300"
              }`}
            >
              {formatFilterLabel(item)}
            </button>
          ))}
        </div>

        {actionData?.error && (
          <div className="mb-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 font-bold text-red-200">
            {actionData.error}
          </div>
        )}

        {actionData?.success && (
          <div className="mb-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 font-bold text-emerald-200">
            {actionData.success}
          </div>
        )}

        {logs.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-8 text-slate-400">
            No activity has happened yet for this shop.
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
                    {formatFilterLabel(log.type)}
                  </span>

                  <h2 className="text-2xl font-bold mt-4">{log.title}</h2>

                  <p className="text-slate-400 mt-3">{log.description}</p>

                  {(log.relatedType || log.relatedId) && (
                    <p className="text-slate-500 mt-4 text-sm">
                      {log.relatedType || "Record"}
                      {log.relatedId ? ` · ${log.relatedId}` : ""}
                    </p>
                  )}
                </div>

                <p className="text-slate-400 text-sm min-w-[180px] text-right">
                  {formatDate(log.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function toActivityCard(record) {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    description: record.description || "",
    relatedType: record.relatedType || "",
    relatedId: record.relatedId || "",
    createdAt: record.createdAt,
  };
}

function formatFilterLabel(value) {
  if (value === "all") return "All";

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
