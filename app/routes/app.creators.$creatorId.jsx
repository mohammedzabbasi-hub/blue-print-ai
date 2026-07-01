import { useLoaderData, useNavigate } from "react-router";

import { authenticate } from "../shopify.server";
import {
  computeCreatorEngagement,
  findImportedCreator,
} from "../models/importedData.server";

export const meta = () => {
  return [{ title: "Creator Detail | BluePrintAI" }];
};

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const creator = await findImportedCreator(session.shop, params.creatorId);

  if (!creator) return { creator: null };

  return { creator: { ...creator, ...computeCreatorEngagement(creator) } };
};

const formatNumber = (value) => {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("en-US").format(number);
};

const formatMoney = (value) => {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `$${new Intl.NumberFormat("en-US").format(Math.round(number))}`;
};

export default function CreatorDetailRoute() {
  const { creator } = useLoaderData();
  const navigate = useNavigate();

  if (!creator) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Creator not found
          </h1>

          <p className="mt-3 text-gray-600">
            This creator was not found. It may have been removed by a data
            reset.
          </p>

          <button
            type="button"
            onClick={() => navigate("/app/creators")}
            className="mt-5 rounded-xl bg-slate-900 px-4 py-2 font-medium text-white"
          >
            Back to creators
          </button>
        </div>
      </main>
    );
  }

  const hasEngagementRate =
    creator.engagementRate !== null && creator.engagementRate !== undefined;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {creator.name || "Unnamed creator"}
              </h1>

              <p className="text-gray-500">
                {creator.handle ? `@${creator.handle}` : "Not imported"}
              </p>

              <p className="mt-3 text-gray-600">
                {creator.notes || "No notes added yet."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/app/creators")}
              className="rounded-xl border border-gray-300 px-4 py-2 font-medium"
            >
              Back to creators
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Followers</p>
            <p className="text-2xl font-bold">
              {formatNumber(creator.followers)}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Views</p>
            <p className="text-2xl font-bold">
              {formatNumber(creator.totalViews)}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Orders</p>
            <p className="text-2xl font-bold">
              {formatNumber(creator.totalOrders)}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Revenue</p>
            <p className="text-2xl font-bold">
              {formatMoney(creator.totalRevenue)}
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Engagement actions</p>
            <p className="text-2xl font-bold">
              {formatNumber(creator.engagementActions)}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Likes + comments + shares from imported data.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Engagement rate</p>
            <p className="text-2xl font-bold">
              {hasEngagementRate
                ? `${Number(creator.engagementRate).toFixed(1)}%`
                : "—"}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {hasEngagementRate
                ? "Engagement actions as a share of total views."
                : "Not enough imported data to compute an engagement rate."}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">Summary</h2>

          <p className="mt-2 text-gray-600">
            {creator.name || "This creator"} has{" "}
            {formatNumber(creator.totalViews)} imported views,{" "}
            {formatNumber(creator.totalOrders)} orders, and{" "}
            {formatMoney(creator.totalRevenue)} in imported revenue
            {hasEngagementRate
              ? `, with an engagement rate of ${Number(
                  creator.engagementRate
                ).toFixed(1)}%.`
              : "."}
          </p>
        </section>
      </div>
    </main>
  );
}
