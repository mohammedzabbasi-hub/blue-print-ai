import { useState } from "react";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import {
  clearImportedData,
  getImportSummary,
  importCsvText,
  importJsonBundleText,
} from "../models/importedData.server";
import { IMPORT_TABLES, IMPORT_TABLE_COLUMNS } from "../utils/importTables";

export const meta = () => {
  return [{ title: "Data Import | BluePrintAI" }];
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const summary = await getImportSummary(session.shop);

  return { summary };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "clear") {
    await clearImportedData(session.shop);
    return { message: "Imported data cleared for this shop.", summary: await getImportSummary(session.shop) };
  }

  if (intent === "upload_csv") {
    const table = String(formData.get("table_name") || "");
    const file = formData.get("file");

    if (!(file instanceof File) || !file.size) {
      return { error: "Choose a CSV file first." };
    }

    if (!IMPORT_TABLES.includes(table)) {
      return { error: `"${table}" is not a valid table.` };
    }

    const text = await file.text();
    const result = await importCsvText(session.shop, table, text);

    return {
      message: `Imported ${result.inserted} row(s) into ${table}. Skipped ${result.skipped} duplicate row(s).`,
      errors: result.errors,
      summary: await getImportSummary(session.shop),
    };
  }

  if (intent === "upload_json") {
    const file = formData.get("file");

    if (!(file instanceof File) || !file.size) {
      return { error: "Choose a JSON file first." };
    }

    const text = await file.text();
    const { results, errors } = await importJsonBundleText(session.shop, text);

    if (errors.length) {
      return { error: errors[0] };
    }

    const inserted = results.reduce((sum, item) => sum + item.inserted, 0);
    const skipped = results.reduce((sum, item) => sum + item.skipped, 0);
    const byTable = Object.fromEntries(results.map((item) => [item.table, item]));

    return {
      message: `Imported ${inserted} new row(s) across ${results.length} table(s). Skipped ${skipped} duplicate row(s).`,
      lastJsonResult: byTable,
      summary: await getImportSummary(session.shop),
    };
  }

  return { error: "No import action was selected." };
};

export default function DataImportRoute() {
  const { summary: loaderSummary } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const isSubmitting = navigation.state === "submitting";
  const summary = actionData?.summary || loaderSummary;

  return (
    <div className="space-y-8">
      <div className="glass-strong rounded-2xl p-8">
        <div className="flex items-center gap-3">
          <p className="text-primary uppercase tracking-[0.18em] font-semibold text-xs">
            Data Setup
          </p>
        </div>

        <h1 className="font-display text-4xl font-semibold mt-3 text-foreground">
          Import Shop Data
        </h1>

        <p className="text-muted-foreground mt-3 text-sm sm:text-[15px]">
          Upload TikTok Shop or ad platform CSV/JSON exports to power the
          Dashboard, Creators, Creative Library, Recommendations, Ad Briefs,
          and Revenue Blueprint with your shop&apos;s real numbers. Nothing
          shown elsewhere in the app is estimated from this data &mdash; pages
          read directly from what you import here.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {IMPORT_TABLES.map((table) => (
            <a
              key={table}
              href={`/sample-data/${table}.csv`}
              download
              className="rounded-lg border border-border-strong bg-surface-2/60 px-4 py-2 text-xs font-semibold text-foreground hover:border-primary/50"
            >
              Download sample {table}.csv
            </a>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Form
          method="post"
          encType="multipart/form-data"
          className="rounded-3xl border border-slate-800 bg-[#0b1220] p-8"
        >
          <input type="hidden" name="intent" value="upload_csv" />

          <h2 className="text-3xl font-black">Upload CSV</h2>

          <p className="text-slate-400 mt-3">
            Choose which table this CSV should fill. Columns:{" "}
            <code className="text-slate-300">
              {IMPORT_TABLE_COLUMNS.products.join(", ")}
            </code>
            {" "}(and similar per table &mdash; see the sample downloads above).
          </p>

          <select
            name="table_name"
            defaultValue="products"
            className="w-full mt-6 rounded-xl bg-slate-900 border border-slate-700 px-5 py-4 text-white"
          >
            {IMPORT_TABLES.map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </select>

          <input
            type="file"
            name="file"
            accept=".csv"
            required
            className="w-full mt-6 rounded-xl bg-slate-900 border border-slate-700 px-5 py-4"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 rounded-xl bg-cyan-500 px-6 py-3 font-black disabled:opacity-50"
          >
            {isSubmitting ? "Uploading..." : "Upload CSV"}
          </button>
        </Form>

        <Form
          method="post"
          encType="multipart/form-data"
          className="rounded-3xl border border-slate-800 bg-[#0b1220] p-8"
        >
          <input type="hidden" name="intent" value="upload_json" />

          <h2 className="text-3xl font-black">Upload JSON Bundle</h2>

          <p className="text-slate-400 mt-3">
            A single JSON file with any of these keys as arrays: {" "}
            <code className="text-slate-300">{IMPORT_TABLES.join(", ")}</code>.
          </p>

          <input
            type="file"
            name="file"
            accept=".json"
            required
            className="w-full mt-6 rounded-xl bg-slate-900 border border-slate-700 px-5 py-4"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 rounded-xl bg-cyan-500 px-6 py-3 font-black disabled:opacity-50"
          >
            {isSubmitting ? "Uploading..." : "Upload JSON"}
          </button>
        </Form>
      </div>

      {actionData?.error && (
        <div className="rounded-2xl border border-red-900 bg-red-950/30 p-5 mt-8 text-red-100 font-bold">
          {actionData.error}
        </div>
      )}

      {actionData?.message && (
        <div className="rounded-2xl border border-cyan-900 bg-cyan-950/30 p-5 mt-8 text-cyan-100 font-bold">
          {actionData.message}
          {actionData.errors?.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-sm font-normal text-amber-200">
              {actionData.errors.slice(0, 5).map((rowError, index) => (
                <li key={index}>{rowError}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {actionData?.lastJsonResult && (
        <div className="rounded-3xl border border-slate-800 bg-[#0b1220] p-8 mt-8">
          <h2 className="text-3xl font-black">Last JSON Import</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mt-6">
            {IMPORT_TABLES.map((table) => (
              <div
                key={table}
                className="rounded-2xl bg-slate-950/40 border border-slate-800 p-5"
              >
                <p className="text-slate-400 font-bold">{table}</p>

                <p className="text-emerald-300 font-black mt-3">
                  Inserted {Number(actionData.lastJsonResult[table]?.inserted || 0).toLocaleString()}
                </p>

                <p className="text-amber-200 font-black mt-1">
                  Skipped {Number(actionData.lastJsonResult[table]?.skipped || 0).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-800 bg-[#0b1220] p-8 mt-8">
        <div className="flex justify-between items-center gap-4">
          <h2 className="text-3xl font-black">Current Imported Data</h2>

          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            disabled={isSubmitting}
            className="rounded-xl border border-red-500/40 px-5 py-3 font-bold text-red-200 disabled:opacity-50"
          >
            Clear Shop Data
          </button>
        </div>

        {confirmClearOpen && (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100">
            <p className="font-black">Clear imported data for this shop?</p>
            <p className="mt-2 text-sm text-red-100/80">
              This removes the imported products, orders, creators, creatives,
              and metrics for the active shop. Saved briefs, saved creatives,
              and revenue blueprints you generated elsewhere in the app are
              not affected.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <Form method="post" onSubmit={() => setConfirmClearOpen(false)}>
                <input type="hidden" name="intent" value="clear" />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-red-500 px-5 py-2.5 font-black text-white disabled:opacity-50"
                >
                  {isSubmitting ? "Clearing..." : "Yes, Clear Data"}
                </button>
              </Form>

              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-700 px-5 py-2.5 font-bold text-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-5 mt-8">
          {IMPORT_TABLES.map((table) => (
            <div
              key={table}
              className="rounded-2xl bg-slate-950/40 border border-slate-800 p-5"
            >
              <p className="text-slate-400 font-bold">{table}</p>
              <p className="text-4xl font-black mt-3">{summary[table] || 0}</p>
            </div>
          ))}
        </div>

        <p className="text-slate-500 mt-6 text-sm">
          See it in action: {" "}
          <Link to="/app" className="text-cyan-300 underline">
            Dashboard
          </Link>
          , {" "}
          <Link to="/app/creators" className="text-cyan-300 underline">
            Creators
          </Link>
          , and {" "}
          <Link to="/app/creative-library" className="text-cyan-300 underline">
            Creative Library
          </Link>{" "}
          read directly from the tables above.
        </p>
      </div>
    </div>
  );
}
