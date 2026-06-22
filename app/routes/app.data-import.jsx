import { useEffect, useState } from "react";
import {
  API_BASE,
  getAuthHeaders,
  getSelectedShopId,
  getAccountLabel,
} from "../lib/accountContext";

export const meta = () => {
  return [{ title: "Data Import | BluePrintAI" }];
};

const tables = ["products", "orders", "creators", "creatives", "metrics"];

function getSafeShopId() {
  if (typeof window === "undefined") return "1";
  return getSelectedShopId();
}

function getSafeAccountLabel() {
  if (typeof window === "undefined") {
    return { shopName: "BluePrintAI" };
  }

  return getAccountLabel();
}

export default function DataImportRoute() {
  const [shopId, setShopId] = useState("1");
  const [account, setAccount] = useState({ shopName: "BluePrintAI" });

  const [tableName, setTableName] = useState("products");
  const [csvFile, setCsvFile] = useState(null);
  const [jsonFile, setJsonFile] = useState(null);
  const [summary, setSummary] = useState({});
  const [lastJsonResult, setLastJsonResult] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  useEffect(() => {
    setShopId(getSafeShopId());
    setAccount(getSafeAccountLabel());
  }, []);

  async function loadSummary() {
    const res = await fetch(
      `${API_BASE}/data-import/summary?shop_id=${encodeURIComponent(shopId)}`,
      {
        headers: getAuthHeaders(),
      }
    );

    const data = await res.json();
    setSummary(data.summary || {});
  }

  useEffect(() => {
    if (!shopId) return;
    loadSummary().catch(console.error);
  }, [shopId]);

  async function uploadCsv() {
    if (!csvFile) {
      setMessage("Choose a CSV file first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const form = new FormData();
    form.append("shop_id", shopId);
    form.append("table_name", tableName);
    form.append("file", csvFile);

    const res = await fetch(`${API_BASE}/data-import/csv`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: form,
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.detail || "CSV import failed.");
    } else {
      setMessage(`Imported ${data.inserted} rows into ${data.table}.`);
      await loadSummary();
    }

    setLoading(false);
  }

  async function uploadJson() {
    if (!jsonFile) {
      setMessage("Choose a JSON file first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const form = new FormData();
    form.append("shop_id", shopId);
    form.append("file", jsonFile);

    const res = await fetch(`${API_BASE}/data-import/json`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: form,
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.detail || "JSON import failed.");
    } else {
      setLastJsonResult({
        inserted: data.inserted || {},
        skipped: data.skipped_duplicates || data.skipped || {},
      });

      const insertedRaw =
        data.inserted_total ??
        data.inserted ??
        data.total_inserted ??
        data.inserted_rows ??
        0;

      const skippedRaw =
        data.skipped_total ??
        data.skipped_duplicates ??
        data.duplicates_skipped ??
        data.skipped_rows ??
        0;

      const sumValue = (value) => {
        if (typeof value === "number") return value;

        if (value && typeof value === "object") {
          return Object.values(value).reduce(
            (sum, item) => sum + Number(item || 0),
            0
          );
        }

        return Number(value || 0);
      };

      const inserted = sumValue(insertedRaw);
      const skipped = sumValue(skippedRaw);

      setMessage(
        `JSON import complete. Imported ${inserted} new rows. Skipped ${skipped} duplicate rows.`
      );

      await loadSummary();
    }

    setLoading(false);
  }

  async function clearData() {
    setLoading(true);
    setConfirmClearOpen(false);

    const res = await fetch(
      `${API_BASE}/data-import/clear?shop_id=${encodeURIComponent(shopId)}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      }
    );

    const data = await res.json();

    setMessage(
      data.success ? "Shop import data cleared." : "Could not clear data."
    );

    await loadSummary();

    setLoading(false);
  }

  return (
    <div className="space-y-8">
      <div className="glass-strong rounded-2xl p-8">
        <div className="flex items-center gap-3">
          <p className="text-primary uppercase tracking-[0.18em] font-semibold text-xs">
            Data Setup
          </p>

          <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-4 py-1 text-xs font-black uppercase tracking-widest text-yellow-200">
            Temporary MVP Only
          </span>
        </div>

        <h1 className="font-display text-4xl font-semibold mt-3 text-foreground">
          Import Shop Data
        </h1>

        <p className="text-muted-foreground mt-3 text-sm sm:text-[15px]">
          Temporary MVP tool: upload TikTok Shop CSV/JSON downloads into this
          workspace until real TikTok Shop OAuth is connected.
        </p>

        <p className="text-muted-foreground mt-3 text-sm">
          Current shop: {account.shopName} · Shop ID: {shopId}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-3xl border border-slate-800 bg-[#0b1220] p-8">
          <h2 className="text-3xl font-black">Upload CSV</h2>

          <p className="text-slate-400 mt-3">
            Choose which table this CSV should fill.
          </p>

          <select
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            className="w-full mt-6 rounded-xl bg-slate-900 border border-slate-700 px-5 py-4 text-white"
          >
            {tables.map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </select>

          <input
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            className="w-full mt-6 rounded-xl bg-slate-900 border border-slate-700 px-5 py-4"
          />

          <button
            type="button"
            onClick={uploadCsv}
            disabled={loading}
            className="mt-6 rounded-xl bg-cyan-500 px-6 py-3 font-black disabled:opacity-50"
          >
            Upload CSV
          </button>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-[#0b1220] p-8">
          <h2 className="text-3xl font-black">Upload JSON Bundle</h2>

          <p className="text-slate-400 mt-3">
            JSON can include products, orders, creators, creatives, and metrics
            arrays.
          </p>

          <input
            type="file"
            accept=".json"
            onChange={(e) => setJsonFile(e.target.files?.[0] || null)}
            className="w-full mt-6 rounded-xl bg-slate-900 border border-slate-700 px-5 py-4"
          />

          <button
            type="button"
            onClick={uploadJson}
            disabled={loading}
            className="mt-6 rounded-xl bg-cyan-500 px-6 py-3 font-black disabled:opacity-50"
          >
            Upload JSON
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-cyan-900 bg-cyan-950/30 p-5 mt-8 text-cyan-100 font-bold">
          {message}
        </div>
      )}

      {lastJsonResult && (
        <div className="rounded-3xl border border-slate-800 bg-[#0b1220] p-8 mt-8">
          <h2 className="text-3xl font-black">Last JSON Import</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mt-6">
            {tables.map((table) => (
              <div
                key={table}
                className="rounded-2xl bg-slate-950/40 border border-slate-800 p-5"
              >
                <p className="text-slate-400 font-bold">{table}</p>

                <p className="text-emerald-300 font-black mt-3">
                  Inserted{" "}
                  {Number(
                    lastJsonResult.inserted?.[table] || 0
                  ).toLocaleString()}
                </p>

                <p className="text-amber-200 font-black mt-1">
                  Skipped{" "}
                  {Number(
                    lastJsonResult.skipped?.[table] || 0
                  ).toLocaleString()}
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
            disabled={loading}
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
              and metrics for the active shop.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={clearData}
                disabled={loading}
                className="rounded-xl bg-red-500 px-5 py-2.5 font-black text-white disabled:opacity-50"
              >
                {loading ? "Clearing..." : "Yes, Clear Data"}
              </button>

              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                disabled={loading}
                className="rounded-xl border border-slate-700 px-5 py-2.5 font-bold text-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-5 mt-8">
          {tables.map((table) => (
            <div
              key={table}
              className="rounded-2xl bg-slate-950/40 border border-slate-800 p-5"
            >
              <p className="text-slate-400 font-bold">{table}</p>
              <p className="text-4xl font-black mt-3">{summary[table] || 0}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
