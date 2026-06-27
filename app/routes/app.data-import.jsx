import {
  Link,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
  useSubmit,
} from "react-router";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Film,
  X,
} from "lucide-react";

import { MAX_PUBLIC_IMPORT_BYTES } from "../constants/import-limits";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";
import {
  appendSelectedVideoFiles,
  buildCreativeImportFormData,
  removeSelectedVideoFile,
  selectedVideoFileKey,
} from "../utils/selected-video-files";

export const meta = () => {
  return [{ title: "Data Import | BluePrintAI" }];
};

const sampleCsv = `creative_id,creative_name,video_filename,platform,campaign_id,campaign_name,ad_id,ad_name,creator_handle,creator_name,creator_platform,creator_profile_url,creator_type,creator_clicks,creator_orders,creator_revenue,creator_commission,creator_notes,product_id,product_name,reporting_date,impressions,reach,video_views,likes,comments,shares,clicks,orders,conversions,revenue,conversion_value,spend,ctr,cvr,roas,cpc,cpm,notes
cr_ice_001,Ice Roller morning demo,ice-roller-demo.mp4,TikTok Ads,camp_summer_26,June Scale Tests,ad_ice_001,Ice Roller Pro morning depuff demo,@mayaglowup,Maya Chen,TikTok,https://www.tiktok.com/@mayaglowup,affiliate,2600,94,4230,423,Optional creator attribution,shopify_101,Ice Roller Pro,2026-06-01,148000,121400,126000,9800,640,850,2600,94,94,4230,4230,820,1.76,3.62,5.16,0.32,5.54,Full paid and engagement metrics
cr_lash_002,LashLift before-after,lashlift-before-after.mp4,Meta Ads,camp_creator_ugc,Creator UGC Batch,ad_lash_002,LashLift Starter Kit before-after,@lashlabdaily,Ari Brooks,Instagram,https://instagram.com/lashlabdaily,ugc,1400,51,2295,230,,shopify_102,LashLift Starter Kit,2026-06-03,101000,88400,84200,6100,320,430,1400,51,51,2295,2295,530,1.39,3.64,4.33,0.38,5.25,Attach a matching video by filename
cr_bundle_003,Glass Skin Bundle shelfie,,Google Ads,camp_pmax_bundle,Performance Max Bundle Push,ad_bundle_003,Glass Skin Bundle shelfie angle,,,,,,,,,,,shopify_103,Glass Skin Bundle,2026-06-09,52000,44100,,2300,120,170,620,17,17,1190,1190,260,1.19,2.74,4.58,0.42,5.00,Valid performance-only creative with optional creator fields blank`;
const requiredColumns = [
  "platform",
  "ad_name/creative_name or video_url/source_url",
  "date/reporting_date",
];

const optionalColumns = [
  "creative_id",
  "campaign/ad identifiers",
  "creator_name",
  "creator_handle and creator_name (either is enough)",
  "creator_platform / creator_profile_url / creator_type",
  "creator_clicks / creator_orders / creator_revenue",
  "creator_commission / creator_notes",
  "product_id / product_name",
  "thumbnail_url",
  "asset_url / source_url",
  "source_type",
  "impressions",
  "reach",
  "clicks",
  "spend",
  "orders / conversions",
  "revenue / conversion_value",
  "ctr / cpc / cpm / cvr / roas",
  "video views and quartiles",
  "average_watch_time",
  "engagements",
  "likes",
  "comments",
  "shares",
  "saves",
  "reposts",
  "notes",
];

const videoFilenameColumns = [
  "video_filename",
  "videoFileName",
  "file_name",
  "filename",
  "asset_filename",
  "creative_filename",
];
const supportedVideoTypes =
  ".mp4,.mov,.m4v,.webm,video/mp4,video/quicktime,video/x-m4v,video/webm";

export const loader = async ({ request }) => {
  const { loadShopifyRouteContext } = await import("../models/route-context.server");
  const {
    listRevenueBlueprints,
    listSavedBriefs,
    listSavedCreatives,
    listVideoAnalyses,
  } = await import("../models/blueprint.server");
  const { listCreativePerformance } = await import(
    "../models/creative-performance.server"
  );
  const { listCampaigns } = await import("../models/campaign.server");
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const [creatives, analyses, briefs, blueprints, performance, campaigns] = await Promise.all([
    listSavedCreatives(session.shop, 1000),
    listVideoAnalyses(session.shop, 1000),
    listSavedBriefs(session.shop, 1000),
    listRevenueBlueprints(session.shop, 1000),
    listCreativePerformance({ merchantData, shop: session.shop, limit: 1000 }),
    listCampaigns(session.shop),
  ]);
  const importedRecords = performance.records.filter(
    (record) =>
      record.importSource === "public_engagement_import" ||
      record.importSource === "creative_upload_performance_import",
  );

  return {
    sampleCsv,
    shop: session.shop,
    campaigns: campaigns.map(({ id, name }) => ({ id, name })),
    counts: {
      analyses: analyses.length,
      blueprints: blueprints.length,
      briefs: briefs.length,
      creatives: creatives.length,
      importedPerformance: importedRecords.length,
      performance: performance.records.length,
    },
  };
};

export const action = async ({ request }) => {
  const { loadShopifyRouteContext } = await import("../models/route-context.server");
  const { parsePublicEngagementCsv, upsertPublicEngagementRecord } = await import(
    "../models/creative-performance.server"
  );
  const {
    buildCreativeUploadPreview,
    getUploadedVideoFiles,
    importMatchedCreativeRows,
  } = await import("../models/creative-upload-import.server");
  const { session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "creative-upload-preview");
  const input = await readCsvInput(formData);
  if (input.error) {
    return {
      actionIntent: intent,
      creativeUploadPreview: intent === "creative-upload-preview",
      errors: [input.error],
      headers: [],
      rows: [],
      totalRows: 0,
    };
  }

  const uploadedVideos = getUploadedVideoFiles(formData);
  const createCreatorProfiles = formData.get("createCreatorProfiles") !== "false";
  const existingCreators = createCreatorProfiles
    ? await (await import("../models/creator-attribution.server")).listCreatorProfiles(session.shop)
    : [];
  const preview = buildCreativeUploadPreview({
    csvText: input.csvText,
    createCreatorProfiles,
    existingCreators,
    parsePublicEngagementCsv,
    uploadedVideos,
  });

  if (intent === "creative-upload-preview") {
    return {
      ...preview,
      actionIntent: intent,
      creativeUploadPreview: true,
      csvText: input.csvText,
      ok: false,
    };
  }

  let campaignId = String(formData.get("campaignId") || "");
  const newCampaignName = String(formData.get("newCampaignName") || "").trim();
  if (!campaignId && newCampaignName) {
    const { createCampaign } = await import("../models/campaign.server");
    const createdCampaign = await createCampaign(session.shop, {
      name: newCampaignName,
      objective: "testing",
      platform: "other",
      status: "draft",
    });
    campaignId = createdCampaign.id;
  }
  const result = await importMatchedCreativeRows({
    campaignId,
    createCreatorProfiles,
    preview,
    shop: session.shop,
    uploadedVideos,
    upsertPublicEngagementRecord,
  });

  return {
    ...result,
    actionIntent: "creative-upload-confirm",
    creativeUploadPreview: false,
    importToastId: createImportToastId(),
  };
};

export default function DataImportRoute() {
  const { campaigns, counts, sampleCsv: loaderSampleCsv, shop } = useLoaderData();
  const actionData = useActionData();
  const location = useLocation();
  const navigation = useNavigation();
  const submit = useSubmit();
  const creativeCsvFileInputRef = useRef(null);
  const videoFileInputRef = useRef(null);
  const [previewCleared, setPreviewCleared] = useState(false);
  const [clearMessage, setClearMessage] = useState("");
  const [creativeUploadCsvDraft, setCreativeUploadCsvDraft] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [newCampaignName, setNewCampaignName] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [videoInputKey, setVideoInputKey] = useState(0);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [createCreatorProfiles, setCreateCreatorProfiles] = useState(true);
  const submitting = navigation.state === "submitting";
  const submittingIntent = navigation.formData
    ? String(navigation.formData.get("intent") || "preview")
    : "";
  const creativeUploadReviewing =
    submitting && submittingIntent === "creative-upload-preview";
  const creativeUploadImporting =
    submitting && submittingIntent === "creative-upload-confirm";
  const visibleActionData = previewCleared ? null : actionData;
  const rows = visibleActionData?.rows || [];
  const hasCreativeUploadPreview =
    visibleActionData?.actionIntent === "creative-upload-preview" &&
    (rows.length > 0 || visibleActionData?.errors?.length > 0);
  const showCreativeUploadConfirm =
    visibleActionData?.creativeUploadPreview && rows.length > 0;
  const hasImportToast =
    actionData?.actionIntent === "creative-upload-confirm" &&
    actionData?.summary;
  const importSucceeded = Boolean(hasImportToast && actionData?.ok);
  const importedPerformanceRows = Number(actionData?.summary?.performanceRows || 0);
  const toastKey = hasImportToast
    ? actionData.importToastId ||
      [
        actionData.ok ? "success" : "error",
        actionData.summary.created,
        actionData.summary.updated,
        actionData.summary.skipped,
        actionData.summary.errors,
        actionData.summary.warnings,
      ].join(":")
    : "";
  const [toastDismissed, setToastDismissed] = useState(false);

  useEffect(() => {
    if (!toastKey) return undefined;

    setToastDismissed(false);
    const timer = window.setTimeout(() => setToastDismissed(true), 6500);

    return () => window.clearTimeout(timer);
  }, [toastKey]);

  useEffect(() => {
    setPreviewCleared(false);

    if (actionData?.actionIntent === "creative-upload-preview") {
      setClearMessage("");
      setCreativeUploadCsvDraft(actionData.csvText || "");
    }
  }, [actionData]);

  function clearImportPreview() {
    setPreviewCleared(true);
    setClearMessage("Import preview cleared. No rows were saved.");
    setCreativeUploadCsvDraft("");
    setFileInputKey((key) => key + 1);
    setVideoInputKey((key) => key + 1);
    setSelectedVideos([]);
    setSelectedCampaignId("");
    setNewCampaignName("");
    setCreateCreatorProfiles(true);
  }

  function addSelectedVideoFiles(fileList) {
    setSelectedVideos((current) =>
      appendSelectedVideoFiles(current, fileList),
    );
    setVideoInputKey((key) => key + 1);
  }

  function removeVideoFile(file) {
    setSelectedVideos((current) => removeSelectedVideoFile(current, file));
  }

  function clearSelectedVideoFiles() {
    setSelectedVideos([]);
    setVideoInputKey((key) => key + 1);
  }

  function submitCreativeImport(intent) {
    const csvFile = creativeCsvFileInputRef.current?.files?.[0];
    const formData = buildCreativeImportFormData({
      campaignId: selectedCampaignId,
      newCampaignName,
      csvFile,
      csvText: creativeUploadCsvDraft,
      intent,
      selectedVideos,
    });
    formData.set("createCreatorProfiles", String(createCreatorProfiles));

    submit(formData, {
      encType: "multipart/form-data",
      method: "post",
    });
  }

  return (
    <div className="space-y-8">
      {hasImportToast && !toastDismissed && (
        <ImportToast
          onClose={() => setToastDismissed(true)}
          summary={actionData.summary}
          tone={importSucceeded ? "success" : "error"}
        />
      )}

      <section className="glass-strong rounded-2xl p-8">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-primary uppercase tracking-[0.18em] font-semibold text-xs">
            Creative data import
          </p>
          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1 text-xs font-black uppercase tracking-widest text-cyan-200">
            CSV + optional videos
          </span>
        </div>

        <h1 className="font-display mt-3 text-4xl font-semibold text-foreground">
          Import creative performance data
        </h1>

        <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
          Upload a CSV and add matching video files to create creative records,
          attach ads to campaigns, and populate dashboard metrics.
        </p>

        <p className="mt-4 max-w-4xl rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs font-semibold leading-5 text-cyan-100">
          Each CSV row becomes an ad or creative performance record. A matching
          video adds a playable Creative Library asset; rows without videos are
          still imported as performance-only creative records.
        </p>
        <p className="mt-3 max-w-4xl rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs font-semibold leading-5 text-amber-100">
          Fields like spend, clicks, orders, revenue, ROAS, and CVR will show as
          unavailable unless they are included in the CSV.
        </p>

        <p className="mt-3 text-sm text-muted-foreground">
          Current Shopify workspace: {shop}
        </p>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300">
            <Film className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
              One guided workflow
            </p>
            <h2 className="mt-1 text-3xl font-black text-white">
              Import creative performance data
            </h2>
          </div>
        </div>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-400">
          Add creative/ad CSV data, optionally attach matching MP4, MOV, M4V,
          or WebM files, choose campaign behavior, and review everything before
          saving.
        </p>

        <div className="mt-6 space-y-6">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                Step 1 · Add CSV data
              </p>
              <label
                className="text-xs font-black uppercase tracking-[0.16em] text-slate-400"
                htmlFor="creative-upload-csv"
              >
                Upload a CSV file
              </label>
              <input
                key={`creative-csv-${fileInputKey}`}
                accept=".csv,text/csv"
                className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-500/15 file:px-3 file:py-2 file:font-bold file:text-emerald-100"
                name="csvFile"
                ref={creativeCsvFileInputRef}
                type="file"
              />
              <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                <span className="h-px flex-1 bg-slate-800" />
                or paste CSV text
                <span className="h-px flex-1 bg-slate-800" />
              </div>
              <textarea
                className="min-h-[190px] w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 font-mono text-xs leading-5 text-slate-200 placeholder:text-slate-600"
                id="creative-upload-csv"
                name="csvText"
                onChange={(event) => setCreativeUploadCsvDraft(event.target.value)}
                placeholder="Paste CSV here, including video_filename for each uploaded file."
                value={creativeUploadCsvDraft}
              />
              <div className="flex flex-wrap items-center gap-3">
                <a
                  className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/20"
                  download="blueprintai-creative-performance-sample.csv"
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(loaderSampleCsv)}`}
                >
                  Download sample CSV
                </a>
                <p className="text-xs font-semibold text-slate-500">
                  Upload a file or paste text—if both are present, the uploaded file is used.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <p
                className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300"
              >
                Step 2 · Add video files (optional)
              </p>
              <input
                key={`creative-videos-${videoInputKey}`}
                accept={supportedVideoTypes}
                className="sr-only"
                id="creative-upload-videos"
                multiple
                name="videoFiles"
                onChange={(event) => addSelectedVideoFiles(event.target.files)}
                ref={videoFileInputRef}
                type="file"
              />
              <div className="flex flex-wrap gap-3">
                <label
                  className="bp-primary-cta cursor-pointer"
                  htmlFor="creative-upload-videos"
                >
                  Choose video files
                </label>
                <button
                  className="rounded-2xl border border-slate-700 bg-slate-950/50 px-5 py-3 text-sm font-black text-slate-200 transition hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-50"
                  onClick={() => videoFileInputRef.current?.click()}
                  type="button"
                >
                  Add more video files
                </button>
                {selectedVideos.length > 0 && (
                  <button
                    className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-black text-slate-300 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-100"
                    onClick={clearSelectedVideoFiles}
                    type="button"
                  >
                    Clear selected files
                  </button>
                )}
              </div>
              {selectedVideos.length > 0 && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
                  <p className="font-black">
                    {selectedVideos.length} {selectedVideos.length === 1 ? "file" : "files"} selected
                  </p>
                  <ul className="mt-2 space-y-1 text-xs font-semibold text-emerald-100/80">
                    {selectedVideos.slice(0, 5).map((file) => (
                      <li
                        className="flex items-center justify-between gap-3"
                        key={selectedVideoFileKey(file)}
                      >
                        <span className="min-w-0 truncate">{file.name}</span>
                        <button
                          aria-label={`Remove ${file.name}`}
                          className="shrink-0 rounded-full border border-emerald-400/20 p-1 text-emerald-100 transition hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-100"
                          onClick={() => removeVideoFile(file)}
                          type="button"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                    {selectedVideos.length > 5 && (
                      <li>+ {selectedVideos.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
              <ColumnList
                title="Filename aliases"
                items={videoFilenameColumns}
              />
              <p className="rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3 text-xs font-semibold leading-5 text-slate-400">
                Filenames are matched case-insensitively using base filenames
                only. A row without a match remains a valid performance-only
                creative; paths, ambiguous duplicates, and unsupported file
                extensions must be fixed before importing that video.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.04] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">Step 3 · Assign campaign</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">Apply an existing or new campaign to every imported row, or leave both fields empty to use row-level campaign_id/campaign_name values.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Select existing campaign
              <select
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-white"
                onChange={(event) => { setSelectedCampaignId(event.target.value); if (event.target.value) setNewCampaignName(""); }}
                value={selectedCampaignId}
              >
                <option value="">Skip / use CSV campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Or create a new campaign
              <input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-white placeholder:text-slate-600" onChange={(event) => { setNewCampaignName(event.target.value); if (event.target.value) setSelectedCampaignId(""); }} placeholder="Campaign name" value={newCampaignName} />
            </label>
            </div>
          </div>
          <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.05] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">Creator attribution</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Rows with creator_name or creator_handle will update Creator Performance and connect creators to imported creatives.
            </p>
            <label className="mt-3 flex items-center gap-3 text-sm font-bold text-slate-200">
              <input
                checked={createCreatorProfiles}
                className="h-4 w-4 accent-violet-400"
                onChange={(event) => setCreateCreatorProfiles(event.target.checked)}
                type="checkbox"
              />
              Create/update creator profiles from CSV rows
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="w-full">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">Step 4 · Review import</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Preview records, video matches, campaign data, warnings, and errors before anything is saved.</p>
            </div>
            <button
              className="bp-primary-cta"
              disabled={submitting}
              onClick={() => submitCreativeImport("creative-upload-preview")}
              type="button"
            >
              {creativeUploadReviewing ? "Reviewing..." : "Review import"}
            </button>
          </div>

          {hasCreativeUploadPreview && (
            <CreativeUploadPreview
              actionData={visibleActionData}
              clearImportPreview={clearImportPreview}
              importing={creativeUploadImporting}
              onImport={() => submitCreativeImport("creative-upload-confirm")}
              showConfirm={showCreativeUploadConfirm}
            />
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-2xl font-black text-white">CSV requirements</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Imports are limited to 500 rows and about{" "}
              {Math.round(MAX_PUBLIC_IMPORT_BYTES / 1024 / 1024)} MB. Values
              are trimmed, formula-like text is neutralized, negative metrics
              are rejected, blank public engagement fields default to 0, and
              blank optional performance fields stay unavailable.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ColumnList title="Required" items={requiredColumns} />
            <ColumnList title="Recommended and optional" items={optionalColumns} />
          </div>
        </div>
      </section>

      {clearMessage && (
        <div
          className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-4 text-sm font-semibold text-cyan-100"
          role="status"
        >
          {clearMessage}
        </div>
      )}

      {hasImportToast && (
        <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
            Import summary
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">Import complete</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-100/90">
            {actionData.summary.created + actionData.summary.updated} records
            imported into BluePrintAI. Your dashboard, recommendations, creator
            comparisons, and blueprints can now use this data.
            {" "}
            {importedPerformanceRows > 0
              ? "Performance metrics included."
              : "Public engagement only."}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-5">
            <Metric label="Created" value={actionData.summary.created} />
            <Metric label="Updated" value={actionData.summary.updated} />
            <Metric label="Skipped" value={actionData.summary.skipped} />
            <Metric label="Errors" value={actionData.summary.errors} />
            <Metric label="Warnings" value={actionData.summary.warnings} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={withEmbeddedRouteParams("/app", location.search)} className="bp-primary-cta">
              Open Command Center
            </Link>
            <Link
              to={withEmbeddedRouteParams("/app/creative-library", location.search)}
              className="bp-primary-cta"
            >
              Open Creative Library
            </Link>
            <Link
              to={withEmbeddedRouteParams("/app/recommendations", location.search)}
              className="bp-primary-cta"
            >
              View Recommendations
            </Link>
            <Link
              to={withEmbeddedRouteParams("/app/creators", location.search)}
              className="bp-primary-cta"
            >
              Compare Creators
            </Link>
          </div>
        </section>
      )}

      <details className="rounded-3xl border border-slate-800 bg-[#0b1220] p-6">
        <summary className="cursor-pointer text-lg font-black text-cyan-100">
          Import help
        </summary>
        <div className="mt-6 space-y-8 border-t border-slate-800 pt-6">
          <div>
            <h2 className="text-xl font-black text-white">
              How BluePrintAI uses this data
            </h2>
            <div className="mt-4 grid gap-5 md:grid-cols-3">
              <UseCard
                title="Dashboard and library"
                text="Imported performance records populate Command Center charts and Creative Library cards with views, engagement, optional clicks, orders, spend, and revenue."
              />
              <UseCard
                title="Creators and recommendations"
                text="Creator comparisons aggregate imported rows by creator handle, and recommendations treat public engagement as a valid planning signal."
              />
              <UseCard
                title="Revenue Blueprint"
                text="Blueprints use imported engagement/performance records for planning guidance. Optional revenue, orders, and spend improve confidence, but outcomes are not guaranteed."
              />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black text-white">
              Persisted workspace records
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Counts are scoped to the current authenticated Shopify workspace.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-6">
              <Metric label="Imported" value={counts.importedPerformance} />
              <Metric label="Performance" value={counts.performance} />
              <Metric label="Creatives" value={counts.creatives} />
              <Metric label="Analyses" value={counts.analyses} />
              <Metric label="Briefs" value={counts.briefs} />
              <Metric label="Blueprints" value={counts.blueprints} />
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

function CreativeUploadPreview({
  actionData,
  clearImportPreview,
  importing,
  onImport,
  showConfirm,
}) {
  const rows = actionData?.rows || [];
  const previewRows = rows.slice(0, 50);
  const summary = actionData?.summary || {};
  const importBlocked = Number(summary.ready || 0) === 0;

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-slate-950/40 p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
            Import preview
          </p>
          <h3 className="mt-2 text-2xl font-black text-white">
            Creative/ad import preview
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Showing first {Math.min(50, rows.length)} of{" "}
            {actionData?.totalRows || rows.length} rows. Only ready rows are
            imported. Performance-only rows remain valid without a video.
          </p>
        </div>

        {showConfirm && (
          <div className="max-w-sm space-y-3">
            <div className="flex flex-wrap gap-3">
              <button
                className="bp-primary-cta disabled:cursor-not-allowed disabled:opacity-50"
                disabled={importing || importBlocked}
                onClick={onImport}
                type="button"
              >
                {importing ? "Importing..." : "Import creative records"}
              </button>
              <button
                className="rounded-2xl border border-slate-700 bg-slate-950/50 px-6 py-3 font-black text-slate-200 transition hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={importing}
                onClick={clearImportPreview}
                type="button"
              >
                Clear preview
              </button>
            </div>
            {importBlocked && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-semibold leading-5 text-amber-100">
                No creative/ad rows are ready to import yet.
              </p>
            )}
          </div>
        )}
      </div>

      <Messages messages={actionData?.errors || []} tone="error" />
      <Messages messages={actionData?.fileWarnings || []} tone="warning" />
      <Messages messages={actionData?.topErrors || []} tone="error" />

      <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Ready to import" value={summary.ready || 0} />
        <Metric label="Missing videos" value={summary.missingVideos || 0} />
        <Metric label="Warnings" value={summary.warnings || 0} />
        <Metric label="Errors" value={summary.errors || 0} />
        <Metric label="Files matched" value={summary.uploadedFilesMatched || 0} />
        <Metric label="Files unused" value={summary.uploadedFilesUnused || 0} />
      </div>

      <div className="mt-4 rounded-2xl border border-violet-400/20 bg-violet-500/[0.05] p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">
          Creator attribution
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Creators detected" value={summary.creatorsDetected || 0} />
          <Metric label="New creators" value={summary.newCreators || 0} />
          <Metric label="Updated creators" value={summary.updatedCreators || 0} />
          <Metric label="Missing identity" value={summary.missingCreatorIdentity || 0} />
          <Metric label="Duplicate rows merged" value={summary.duplicateCreatorRowsMerged || 0} />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-[1320px] w-full border-collapse text-left">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              {[
                "Row",
                "Status",
                "Video filename",
                "Matched file",
                "Product",
                "Creative title",
                "Creator",
                "Platform",
                "Views",
                "Clicks",
                "Orders",
                "Revenue",
                "Spend",
                "Messages",
              ].map((heading) => (
                <th key={heading} className="px-5 py-4">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row) => (
              <CreativeUploadPreviewRow key={row.rowNumber} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CreativeUploadPreviewRow({ row }) {
  const record = row.record || {};
  const messages = [...(row.errors || []), ...(row.warnings || [])];
  const statusLabel = row.creativeUploadStatus || "Ready";
  const tone =
    row.status === "error"
      ? "border-red-500/30 bg-red-500/10 text-red-100"
      : row.status === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";

  return (
    <tr className="border-t border-white/10 text-sm text-slate-300">
      <td className="px-5 py-4">{row.rowNumber}</td>
      <td className="px-5 py-4">
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${tone}`}>
          {statusLabel}
        </span>
      </td>
      <td className="px-5 py-4">{row.videoFilename || "Direct video URL"}</td>
      <td className="px-5 py-4">{row.matchedUploadedFile || "Not matched"}</td>
      <td className="px-5 py-4">
        {record.productName || record.productLabel || record.productHandle || "Not provided"}
      </td>
      <td className="px-5 py-4 font-bold text-white">
        {record.adName || record.creativeName || record.creativeTitle || "Untitled creative"}
      </td>
      <td className="px-5 py-4">{record.creatorHandle || record.creatorName || "Not provided"}</td>
      <td className="px-5 py-4">{record.platform || record.sourcePlatform || "Unknown"}</td>
      <td className="px-5 py-4">{formatOptionalNumber(record.videoViews ?? record.views)}</td>
      <td className="px-5 py-4">{formatOptionalNumber(record.clicks)}</td>
      <td className="px-5 py-4">{formatOptionalNumber(record.orders ?? record.conversions)}</td>
      <td className="px-5 py-4">{formatOptionalCurrency(record.revenue ?? record.conversionValue)}</td>
      <td className="px-5 py-4">{formatOptionalCurrency(record.spend)}</td>
      <td className="px-5 py-4">
        {messages.length ? messages.join(" ") : "Ready to import."}
      </td>
    </tr>
  );
}

function ImportToast({ onClose, summary, tone }) {
  const success = tone === "success";
  const Icon = success ? CheckCircle2 : AlertTriangle;
  const title = success ? "Import complete" : "Import failed";
  const body = success
    ? `Your CSV records were imported into BluePrintAI successfully. ${
        Number(summary.performanceRows || 0) > 0
          ? "Performance metrics included."
          : "Public engagement only."
      }`
    : "Some records could not be imported. Review the errors and try again.";
  const classes = success
    ? "border-cyan-400/40 bg-slate-950/95 text-cyan-50 shadow-cyan-950/40"
    : "border-red-400/40 bg-slate-950/95 text-red-50 shadow-red-950/40";
  const iconClasses = success ? "text-cyan-300" : "text-red-300";

  return (
    <div
      aria-live="polite"
      className={`fixed right-5 top-5 z-50 w-[min(420px,calc(100vw-40px))] rounded-2xl border p-5 shadow-2xl backdrop-blur ${classes}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClasses}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase tracking-[0.16em]">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{body}</p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            Created: {formatNumber(summary.created)} · Updated:{" "}
            {formatNumber(summary.updated)} · Skipped:{" "}
            {formatNumber(summary.skipped)}
          </p>
        </div>
        <button
          aria-label="Close import notification"
          className="rounded-full border border-white/10 p-1.5 text-slate-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

async function readCsvInput(formData) {
  const pasted = String(formData.get("csvText") || "");
  const file = formData.get("csvFile");

  if (file && typeof file.text === "function" && file.size > 0) {
    if (file.size > MAX_PUBLIC_IMPORT_BYTES) {
      return { error: "CSV file is larger than the 2 MB import limit." };
    }
    return { csvText: await file.text() };
  }

  return { csvText: pasted };
}

function createImportToastId() {
  return `import:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function ColumnList({ items, title }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
        {title}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function Messages({ messages = [], tone = "error" }) {
  if (!messages.length) return null;
  const classes =
    tone === "error"
      ? "border-red-500/30 bg-red-500/10 text-red-100"
      : "border-amber-500/30 bg-amber-500/10 text-amber-100";

  return (
    <div className={`mt-5 rounded-2xl border px-5 py-4 text-sm font-semibold ${classes}`}>
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  );
}

function Metric({ label, value }) {
  const formattedValue =
    typeof value === "number" ? Number(value || 0).toLocaleString() : value || 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-white">{formattedValue}</p>
    </div>
  );
}

function UseCard({ text, title }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <h3 className="text-lg font-black text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function hasOptionalValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function formatOptionalCurrency(value) {
  return hasOptionalValue(value) ? formatCurrency(value) : "Not imported";
}

function formatOptionalNumber(value) {
  return hasOptionalValue(value) ? formatNumber(value) : "Not imported";
}
