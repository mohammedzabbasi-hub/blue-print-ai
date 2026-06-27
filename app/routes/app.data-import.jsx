import {
  Form,
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
  Download,
  FileUp,
  Film,
  Table2,
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

const sampleCsv = `creative_id,platform,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,creator_handle,creator_name,product_id,product_name,product_handle,thumbnail_url,video_url,asset_url,source_url,source_type,reporting_date,impressions,reach,clicks,spend,conversions,orders,revenue,conversion_value,ctr,cpc,cpm,cvr,roas,video_views,video_2_second_views,video_3_second_views,video_25_percent_watched,video_50_percent_watched,video_75_percent_watched,video_100_percent_watched,average_watch_time,engagements,likes,comments,shares,notes
cr_ice_001,TikTok Ads,camp_summer_26,June Scale Tests,adset_warm_01,Warm skincare shoppers,ad_ice_001,Ice Roller Pro morning depuff demo,@mayaglowup,Maya Chen,shopify_101,Ice Roller Pro,ice-roller-pro,https://example.com/thumbs/ice.jpg,/uploads/creative-library/blueprintai-test-store.myshopify.com/ice-roller-pro-demo.mp4,https://cdn.example.com/ice.mp4,https://www.tiktok.com/@mayaglowup/video/1,csv,2026-06-01,148000,121400,2600,820,94,94,4230,4230,1.76,0.32,5.54,3.62,5.16,126000,94000,88200,69000,42100,23800,11600,8.4,11290,9800,640,850,Full paid and video metrics
cr_lash_002,Meta Ads,camp_creator_ugc,Creator UGC Batch,adset_retarget_02,Retargeting beauty carts,ad_lash_002,LashLift Starter Kit before-after,@lashlabdaily,Ari Brooks,shopify_102,LashLift Starter Kit,lashlift-starter-kit,https://example.com/thumbs/lash.jpg,https://example.com/video/lash.mp4,https://cdn.example.com/lash.mp4,https://instagram.com/reel/2,csv,2026-06-03,101000,88400,1400,530,51,51,2295,2295,,,,,4.33,84200,62100,58800,39200,21400,12200,7100,7.2,6850,6100,320,430,Derived CTR/CPC/CPM/CVR from base inputs
cr_glow_003,YouTube Ads,camp_shorts_test,Shorts Prospecting,ad_group_04,Routine shoppers,ad_glow_003,GlowPrep Headband Set routine,@skincarewithnora,Nora Patel,shopify_103,GlowPrep Headband Set,glowprep-headband-set,https://example.com/thumbs/glow.jpg,https://example.com/video/glow.mp4,https://cdn.example.com/glow.mp4,https://youtube.com/shorts/3,csv,2026-06-05,57500,50100,720,260,17,17,1190,1190,,,,,,,,,,,,,4550,3600,190,240,Partial row with missing video quartiles
cr_bundle_004,Google Ads,camp_pmax_bundle,Performance Max Bundle Push,ad_group_07,Bundle shoppers,ad_bundle_004,Glass Skin Bundle shelfie angle,@beautyops,Leah Kim,shopify_104,Glass Skin Bundle,glass-skin-bundle,https://example.com/thumbs/bundle.jpg,,https://cdn.example.com/bundle.jpg,https://example.com/ads/bundle,csv,2026-06-09,52000,44100,620,260,17,17,1190,1190,1.19,0.42,5.00,2.74,4.58,,,,,,,,2600,2300,120,170,Static/image creative with no video metrics`;
const requiredColumns = [
  "platform",
  "ad_name/creative_name or video_url/source_url",
  "date/reporting_date",
];

const optionalColumns = [
  "creative_id",
  "campaign/ad identifiers",
  "creator_name",
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
  const {
    importPublicEngagementRows,
    parsePublicEngagementCsv,
    upsertPublicEngagementRecord,
  } = await import("../models/creative-performance.server");
  const {
    buildCreativeUploadPreview,
    getUploadedVideoFiles,
    importMatchedCreativeRows,
  } = await import("../models/creative-upload-import.server");
  const { session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "preview");
  const isCreativeUploadIntent =
    intent === "creative-upload-preview" || intent === "creative-upload-confirm";

  if (isCreativeUploadIntent) {
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
    const preview = buildCreativeUploadPreview({
      csvText: input.csvText,
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
      preview,
      shop: session.shop,
      uploadedVideos,
      upsertPublicEngagementRecord,
    });

    return {
      ...result,
      actionIntent: intent,
      creativeUploadPreview: false,
      importToastId: createImportToastId(),
    };
  }

  const input = await readCsvInput(formData);

  if (input.error) {
    const response = {
      actionIntent: intent,
      errors: [input.error],
      headers: [],
      rows: [],
      totalRows: 0,
    };

    if (intent === "confirm") {
      return {
        ...response,
        importToastId: createImportToastId(),
        ok: false,
        summary: {
          created: 0,
          errors: 1,
          skipped: 0,
          updated: 0,
          warnings: 0,
        },
        topErrors: [input.error],
      };
    }

    return response;
  }
  const csvText = input.csvText;

  if (intent === "confirm") {
    const result = await importPublicEngagementRows({
      csvText,
      shop: session.shop,
    });

    return {
      ...result,
      actionIntent: "confirm",
      importToastId: createImportToastId(),
    };
  }

  return {
    ...parsePublicEngagementCsv(csvText),
    actionIntent: "preview",
    csvText,
    ok: false,
    preview: true,
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
  const [csvDraft, setCsvDraft] = useState("");
  const [creativeUploadCsvDraft, setCreativeUploadCsvDraft] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [newCampaignName, setNewCampaignName] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [videoInputKey, setVideoInputKey] = useState(0);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const submitting = navigation.state === "submitting";
  const submittingIntent = navigation.formData
    ? String(navigation.formData.get("intent") || "preview")
    : "";
  const previewSubmitting = submitting && submittingIntent === "preview";
  const importing = submitting && submittingIntent === "confirm";
  const creativeUploadReviewing =
    submitting && submittingIntent === "creative-upload-preview";
  const creativeUploadImporting =
    submitting && submittingIntent === "creative-upload-confirm";
  const visibleActionData = previewCleared ? null : actionData;
  const isCreativeUploadAction =
    visibleActionData?.actionIntent === "creative-upload-preview" ||
    visibleActionData?.actionIntent === "creative-upload-confirm";
  const rows = visibleActionData?.rows || [];
  const readyRows = rows.filter((row) => row.status === "ready").length;
  const warningRows = rows.filter((row) => row.status === "warning").length;
  const errorRows = rows.filter((row) => row.status === "error").length;
  const validRows = readyRows + warningRows;
  const previewRows = rows.slice(0, 25);
  const csvForConfirm = visibleActionData?.csvText || loaderSampleCsv;
  const hasPreview =
    !isCreativeUploadAction &&
    (rows.length > 0 || visibleActionData?.errors?.length > 0);
  const showConfirm = visibleActionData?.preview && rows.length > 0;
  const hasCreativeUploadPreview =
    isCreativeUploadAction &&
    (rows.length > 0 || visibleActionData?.errors?.length > 0);
  const showCreativeUploadConfirm =
    visibleActionData?.creativeUploadPreview && rows.length > 0;
  const hasImportToast =
    ["confirm", "creative-upload-confirm"].includes(actionData?.actionIntent) &&
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

    if (actionData?.actionIntent === "preview") {
      setClearMessage("");
      setCsvDraft(actionData.csvText || "");
    }
    if (actionData?.actionIntent === "creative-upload-preview") {
      setClearMessage("");
      setCreativeUploadCsvDraft(actionData.csvText || "");
    }
  }, [actionData]);

  function clearImportPreview() {
    setPreviewCleared(true);
    setClearMessage("Import preview cleared. No rows were saved.");
    setCsvDraft("");
    setCreativeUploadCsvDraft("");
    setFileInputKey((key) => key + 1);
    setVideoInputKey((key) => key + 1);
    setSelectedVideos([]);
    setSelectedCampaignId("");
    setNewCampaignName("");
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

    submit(formData, {
      encType: "multipart/form-data",
      method: "post",
    });
  }

  const confirmLabel = "Import valid rows";
  const importBlockedReason =
    errorRows > 0
      ? "Some rows need fixes before import. Review the errors in the preview table below."
      : validRows === 0 && rows.length > 0
        ? "No valid rows are ready to import yet."
        : "";

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
            Public Engagement Import
          </p>
          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1 text-xs font-black uppercase tracking-widest text-cyan-200">
            CSV and manual paste
          </span>
        </div>

        <h1 className="font-display mt-3 text-4xl font-semibold text-foreground">
          Import performance data
        </h1>

        <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
          Upload Level 1 public engagement stats, then add Level 2 optional
          performance stats when you have ad, affiliate, or store attribution
          data.
        </p>

        <p className="mt-4 max-w-4xl rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs font-semibold leading-5 text-cyan-100">
          BluePrintAI does not scrape TikTok, Instagram, or Meta automatically.
          Imported records come from merchant-provided CSV/manual data.
        </p>
        <p className="mt-3 max-w-4xl rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs font-semibold leading-5 text-amber-100">
          Fields like spend, clicks, orders, revenue, ROAS, and CVR will show as
          unavailable unless they are included in the CSV.
        </p>

        <p className="mt-3 text-sm text-muted-foreground">
          Current Shopify workspace: {shop}
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <ImportCard icon={FileUp} title="Upload CSV">
          <Form method="post" encType="multipart/form-data" className="space-y-4">
            <input type="hidden" name="intent" value="preview" />
            <input
              key={fileInputKey}
              accept=".csv,text/csv"
              className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-500/15 file:px-3 file:py-2 file:font-bold file:text-cyan-100"
              name="csvFile"
              type="file"
            />
            <button type="submit" disabled={submitting} className="bp-primary-cta">
              {previewSubmitting ? "Reviewing..." : "Review uploaded CSV"}
            </button>
            <p className="text-xs font-semibold leading-5 text-slate-400">
              Review checks your rows for missing fields, calculates engagement
              rate, and shows what will be created or updated before anything is
              saved.
            </p>
          </Form>
        </ImportCard>

        <ImportCard icon={Table2} title="Paste CSV">
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="preview" />
            <textarea
              className="min-h-[240px] w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 font-mono text-xs leading-5 text-slate-200 placeholder:text-slate-600"
              name="csvText"
              onChange={(event) => setCsvDraft(event.target.value)}
              placeholder={loaderSampleCsv}
              value={csvDraft}
            />
            <button type="submit" disabled={submitting} className="bp-primary-cta">
              {previewSubmitting ? "Reviewing..." : "Review pasted CSV"}
            </button>
            <p className="text-xs font-semibold leading-5 text-slate-400">
              Pasted CSV is reviewed first. Records are only saved after you
              confirm the import.
            </p>
          </Form>
        </ImportCard>

        <ImportCard icon={Download} title="Download sample CSV">
          <p className="text-sm leading-6 text-slate-400">
            Use the sample to format merchant-provided public post stats and a
            complete optional performance set. Rows are demo examples only.
          </p>
          <a
            className="bp-primary-cta mt-5"
            download="blueprintai-public-engagement-sample.csv"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(loaderSampleCsv)}`}
          >
            Download sample CSV
          </a>
        </ImportCard>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300">
            <Film className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
              Import creatives + performance
            </p>
            <h2 className="mt-1 text-3xl font-black text-white">
              Match CSV rows to uploaded videos
            </h2>
          </div>
        </div>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-400">
          Upload or paste performance CSV data, add the matching MP4, MOV, M4V,
          or WebM files, then review the row-to-file matches before saving.
          Stored files are written under the current Shopify shop in
          public uploads with a fingerprint prefix to avoid accidental
          overwrites.
        </p>

        <div className="mt-6 space-y-6">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <label
                className="text-xs font-black uppercase tracking-[0.16em] text-slate-400"
                htmlFor="creative-upload-csv"
              >
                CSV file or pasted CSV
              </label>
              <input
                key={`creative-csv-${fileInputKey}`}
                accept=".csv,text/csv"
                className="block w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-500/15 file:px-3 file:py-2 file:font-bold file:text-emerald-100"
                name="csvFile"
                ref={creativeCsvFileInputRef}
                type="file"
              />
              <textarea
                className="min-h-[190px] w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 font-mono text-xs leading-5 text-slate-200 placeholder:text-slate-600"
                id="creative-upload-csv"
                name="csvText"
                onChange={(event) => setCreativeUploadCsvDraft(event.target.value)}
                placeholder="Paste CSV here, including video_filename for each uploaded file."
                value={creativeUploadCsvDraft}
              />
            </div>
            <div className="space-y-3">
              <p
                className="text-xs font-black uppercase tracking-[0.16em] text-slate-400"
              >
                Video files
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
                only. Rows with paths, ambiguous duplicates, missing videos, or
                unsupported video extensions are skipped unless they already
                include a direct playable video URL.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.04] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">Optional campaign assignment</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">Add every matched creative to an existing campaign, create a new one, or leave both fields empty to skip.</p>
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
          <div className="flex flex-wrap gap-3">
            <button
              className="bp-primary-cta"
              disabled={submitting}
              onClick={() => submitCreativeImport("creative-upload-preview")}
              type="button"
            >
              {creativeUploadReviewing ? "Reviewing..." : "Review creative import"}
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

      {hasPreview && (
        <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                Import preview
              </p>
              <h2 className="mt-2 text-3xl font-black text-white">Import preview</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Review detected records before saving them to this Shopify
                workspace.
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Showing first {Math.min(25, rows.length)} of{" "}
                {visibleActionData?.totalRows || rows.length} rows.
              </p>
            </div>

            {showConfirm && (
              <Form method="post" className="max-w-sm space-y-3">
                <input type="hidden" name="intent" value="confirm" />
                <textarea className="hidden" name="csvText" readOnly value={csvForConfirm} />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={importing || validRows === 0 || errorRows > 0}
                    className="bp-primary-cta disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {importing ? "Importing..." : confirmLabel}
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl border border-slate-700 bg-slate-950/50 px-6 py-3 font-black text-slate-200 transition hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={importing}
                    onClick={clearImportPreview}
                  >
                    Clear preview
                  </button>
                </div>
                {importBlockedReason && (
                  <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-semibold leading-5 text-amber-100">
                    {importBlockedReason}
                  </p>
                )}
                <p className="text-xs font-semibold leading-5 text-slate-400">
                  Importing will save valid rows as shop-scoped BluePrintAI
                  performance records. Duplicate rows will update existing
                  records.
                </p>
              </Form>
            )}
          </div>

          <Messages messages={visibleActionData?.errors || []} tone="error" />
          <Messages messages={visibleActionData?.topErrors || []} tone="error" />

          {rows.length > 0 && (
            <div className="mt-6 grid gap-4 md:grid-cols-5">
              <Metric label="Ready rows" value={readyRows} />
              <Metric label="Warning rows" value={warningRows} />
              <Metric label="Error rows" value={errorRows} />
              <Metric
                label="Created"
                value={visibleActionData?.summary?.created ?? "Preview"}
              />
              <Metric
                label="Updated"
                value={visibleActionData?.summary?.updated ?? "Preview"}
              />
            </div>
          )}

          <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-[1120px] w-full border-collapse text-left">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  {[
                    "Row",
                    "Status",
                    "Product",
                    "Creator",
                    "Platform",
                    "Campaign / ad",
                    "Impressions",
                    "Clicks",
                    "Spend",
                    "Orders / conv.",
                    "Revenue",
                    "ROAS",
                    "CTR",
                    "CVR",
                    "Video views",
                    "Completion",
                    "Message",
                  ].map((heading) => (
                    <th key={heading} className="px-5 py-4">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <PreviewRow key={row.rowNumber} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
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

      <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-8">
        <h2 className="text-3xl font-black text-white">
          How BluePrintAI uses this data
        </h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
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
      </section>

      <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-8">
        <h2 className="text-3xl font-black text-white">
          Persisted workspace records
        </h2>
        <p className="mt-3 text-slate-400">
          These counts are scoped to the current authenticated Shopify workspace.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-6">
          <Metric label="Imported" value={counts.importedPerformance} />
          <Metric label="Performance" value={counts.performance} />
          <Metric label="Creatives" value={counts.creatives} />
          <Metric label="Analyses" value={counts.analyses} />
          <Metric label="Briefs" value={counts.briefs} />
          <Metric label="Blueprints" value={counts.blueprints} />
        </div>
      </section>
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
            Creative import matches
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Showing first {Math.min(50, rows.length)} of{" "}
            {actionData?.totalRows || rows.length} rows. Only ready rows are
            imported.
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
                {importing ? "Importing..." : "Import matched creatives"}
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
                No matched creative rows are ready to import yet.
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

function ImportCard({ children, icon: Icon, title }) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-[#0b1220] p-6">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-xl font-black text-white">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
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

function PreviewRow({ row }) {
  const record = row.record || {};
  const messages = [...(row.errors || []), ...(row.warnings || [])];
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
          {row.status === "error" ? "Error" : row.status === "warning" ? "Warning" : "Ready"}
        </span>
      </td>
      <td className="px-5 py-4">
        {record.productName || record.productLabel || record.productHandle || "Not provided"}
      </td>
      <td className="px-5 py-4">{record.creatorHandle || record.creatorName || "Not provided"}</td>
      <td className="px-5 py-4">{record.platform || "Unknown"}</td>
      <td className="px-5 py-4 font-bold text-white">
        {record.campaignName ? `${record.campaignName} / ` : ""}
        {record.adName || record.creativeName || record.creativeTitle || "Untitled creative"}
      </td>
      <td className="px-5 py-4">{formatOptionalNumber(record.impressions)}</td>
      <td className="px-5 py-4">{formatOptionalNumber(record.clicks)}</td>
      <td className="px-5 py-4">{formatOptionalCurrency(record.spend)}</td>
      <td className="px-5 py-4">
        {formatOptionalNumber(record.orders ?? record.conversions)}
      </td>
      <td className="px-5 py-4">
        {formatOptionalCurrency(record.revenue ?? record.conversionValue)}
      </td>
      <td className="px-5 py-4">{formatOptionalRate(record.roas, "x")}</td>
      <td className="px-5 py-4">{formatOptionalRate(record.ctr, "%")}</td>
      <td className="px-5 py-4">{formatOptionalRate(record.conversionRate, "%")}</td>
      <td className="px-5 py-4">{formatOptionalNumber(record.videoViews ?? record.views)}</td>
      <td className="px-5 py-4">
        {formatOptionalRate(record.videoCompletionRate, "%")}
      </td>
      <td className="px-5 py-4">
        {messages.length ? messages.join(" ") : "Ready to import."}
      </td>
    </tr>
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

function formatOptionalRate(value, suffix) {
  return hasOptionalValue(value) ? `${Number(value).toFixed(2)}${suffix}` : "Not imported";
}
