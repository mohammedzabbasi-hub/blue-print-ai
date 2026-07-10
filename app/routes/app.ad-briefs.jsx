import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useLoaderData, useLocation } from "react-router";
import { Copy, Edit3, FilePlus2, FolderOpen, Trash2, X } from "lucide-react";

import EmptyWorkspaceState from "../components/EmptyWorkspaceState";
import {
  createCreativeBriefPreview,
  deleteCreativeBrief,
  duplicateCreativeBrief,
  findSavedCreative,
  getWorkspaceProfile,
  listSavedBriefs,
  listSavedCreatives,
  listVideoAnalyses,
  productFromWorkspaceProfile,
  saveCreativeBriefPreview,
  updateCreativeBrief,
} from "../models/blueprint.server";
import { listCreativePerformance } from "../models/creative-performance.server";
import { buildProductContext } from "../models/product-context";
import { loadShopifyRouteContext } from "../models/route-context.server";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";

export const meta = () => [{ title: "Creative Briefs | BluePrintAI" }];

const OBJECTIVES = ["Awareness", "Traffic", "Conversions", "Product launch", "Retargeting", "UGC", "Testing a new angle"];
const PLATFORMS = ["TikTok", "Instagram Reels", "YouTube Shorts", "Meta Ads", "Google Ads", "Other"];
const FORMATS = ["UGC testimonial", "Product demo", "Problem/solution", "Before and after", "Founder story", "Comparison", "Educational", "Lifestyle"];
const TONES = ["Authentic", "Energetic", "Educational", "Premium", "Conversational", "Urgent", "Playful", "Direct response"];

export const loader = async ({ request }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const [briefs, profile, performance, savedCreatives, analyses] = await Promise.all([
    listSavedBriefs(session.shop, 100),
    getWorkspaceProfile(session.shop),
    listCreativePerformance({ merchantData, shop: session.shop }),
    listSavedCreatives(session.shop, 100),
    listVideoAnalyses(session.shop, 100),
  ]);
  const productContext = buildProductContext({
    shopifyProducts: merchantData.products,
    performanceRecords: performance.records,
  });
  const manualProduct = productFromWorkspaceProfile(profile);
  const products = [...productContext.availableProducts];
  if (manualProduct && !products.some((product) => product.id === manualProduct.id)) products.push(manualProduct);
  const performanceCreatives = performance.records
    .filter((record) => record.sourcePlatform !== "shopify_demo" && record.sourceType !== "demo" && record.sourceRecordType !== "creator_performance_import")
    .map((record) => ({
      ...record,
      id: record.id,
      title: record.creativeTitle || record.adName || record.title || "Connected creative",
      sourceLabel: record.platform || record.sourcePlatform || "Connected performance data",
    }));
  const creativeIds = new Set();
  const creatives = [...savedCreatives.map((creative) => ({ ...creative, sourceLabel: "Creative Library" })), ...performanceCreatives]
    .filter((creative) => creative.id && !creativeIds.has(creative.id) && creativeIds.add(creative.id));
  const url = new URL(request.url);

  return {
    analyses: analyses.map(toAnalysisOption),
    briefs: briefs.map(toBriefView),
    creatives: creatives.map(toCreativeOption),
    products: products.map(toProductOption),
    selectedBriefId: url.searchParams.get("briefId") || "",
    selectedProductId: url.searchParams.get("productId") || profile.selectedProductId || products[0]?.id || "",
  };
};

export const action = async ({ request }) => {
  const { merchantData, session } = await loadShopifyRouteContext(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  try {
    if (["generate", "save"].includes(intent)) {
      const sources = await loadBriefSources({ merchantData, session, formData });
      if (intent === "generate") {
        const input = readSetupInput(formData);
        validateSetup(input, sources.product);
        return { intent, preview: createCreativeBriefPreview(session.shop, input, sources) };
      }

      const preview = parseObject(formData.get("previewJson"));
      validatePreviewSources(preview, sources);
      const saved = await saveCreativeBriefPreview(session.shop, preview, String(formData.get("previewToken") || ""));
      return { brief: toBriefView(saved), intent, success: saved.wasCreated ? "Creative brief saved." : "This preview was already saved." };
    }

    const briefId = String(formData.get("briefId") || "");
    if (!briefId) return { intent, error: "Choose a creative brief first." };

    if (intent === "update") {
      const content = parseObject(formData.get("contentJson"));
      const updated = await updateCreativeBrief(session.shop, briefId, {
        title: formData.get("title"), status: formData.get("status"),
        campaignObjective: formData.get("campaignObjective"), targetAudience: formData.get("targetAudience"),
        platform: formData.get("platform"), creativeFormat: formData.get("creativeFormat"),
        tone: formData.get("tone"), merchantNotes: formData.get("merchantNotes"), content,
      });
      if (!updated) return { intent, error: "Creative brief was not found in this workspace." };
      return { brief: toBriefView(updated), intent, success: "Creative brief updated." };
    }
    if (intent === "duplicate") {
      const duplicated = await duplicateCreativeBrief(session.shop, briefId, String(formData.get("duplicateKey") || ""));
      if (!duplicated) return { intent, error: "Creative brief was not found in this workspace." };
      return { brief: toBriefView(duplicated), intent, sourceBriefId: briefId, success: duplicated.wasCreated ? "Creative brief duplicated." : "This copy already exists." };
    }
    if (intent === "delete") {
      const deleted = await deleteCreativeBrief(session.shop, briefId);
      return deleted
        ? { briefId, intent, success: "Creative brief deleted." }
        : { intent, error: "Creative brief was not found in this workspace." };
    }
    return { intent, error: "Unknown Creative Briefs action." };
  } catch (error) {
    console.error("[creative-briefs] action failed", { intent, message: error?.message, shop: session.shop });
    const safeMessage = error?.message?.startsWith("Choose ") || error?.message?.startsWith("Enter ") || error?.message?.startsWith("This preview")
      ? error.message
      : "Brief generation is temporarily unavailable. Try again shortly or continue with a manual draft.";
    return { intent, error: safeMessage };
  }
};

async function loadBriefSources({ merchantData, session, formData }) {
  const [profile, performance, analyses] = await Promise.all([
    getWorkspaceProfile(session.shop),
    listCreativePerformance({ merchantData, shop: session.shop }),
    listVideoAnalyses(session.shop, 100),
  ]);
  const context = buildProductContext({ shopifyProducts: merchantData.products, performanceRecords: performance.records });
  const manualProduct = productFromWorkspaceProfile(profile);
  const products = [...context.availableProducts, ...(manualProduct ? [manualProduct] : [])];
  const productId = String(formData.get("productId") || "");
  const product = products.find((candidate) => candidate.id === productId) || null;
  const creativeId = String(formData.get("sourceCreativeId") || "");
  let creative = null;
  if (creativeId) {
    creative = await findSavedCreative(session.shop, creativeId);
    if (!creative) creative = performance.records.find((candidate) => candidate.id === creativeId) || null;
    if (!creative) throw new Error("Choose a source creative from this workspace.");
  }
  const analysisId = String(formData.get("sourceVideoAnalysisId") || "");
  const analysis = analysisId ? analyses.find((candidate) => candidate.id === analysisId) || null : null;
  if (analysisId && !analysis) throw new Error("Choose a saved video analysis from this workspace.");
  return { analysis, creative, product };
}

function validateSetup(input, product) {
  if (!product) throw new Error("Choose a Shopify product or available product context.");
  if (!input.campaignObjective) throw new Error("Choose a campaign objective.");
  if (!input.targetAudience) throw new Error("Enter a target audience.");
  if (!input.platform) throw new Error("Choose a platform or placement.");
  if (!input.creativeFormat) throw new Error("Choose a creative format.");
}

function validatePreviewSources(preview, sources) {
  if (!preview?.setup) throw new Error("This preview is no longer available. Generate it again.");
  validateSetup(preview.setup, sources.product);
  if (preview.setup.productId !== sources.product?.id) throw new Error("This preview changed before it could be saved. Generate it again and retry.");
  if ((preview.setup.sourceCreativeId || "") !== (sources.creative?.id || "")) throw new Error("Choose a source creative from this workspace.");
  if ((preview.setup.sourceVideoAnalysisId || "") !== (sources.analysis?.id || "")) throw new Error("Choose a saved video analysis from this workspace.");
}

export default function CreativeBriefsRoute() {
  const data = useLoaderData();
  const fetcher = useFetcher();
  const location = useLocation();
  const [workspace, setWorkspace] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedBriefId, setSelectedBriefId] = useState(data.selectedBriefId);
  const [editing, setEditing] = useState(false);
  const [deleteBrief, setDeleteBrief] = useState(null);
  const [notice, setNotice] = useState(null);
  const handled = useRef(null);
  const duplicateKeys = useRef(new Map());
  const pending = fetcher.state !== "idle";
  const selectedBrief = data.briefs.find((brief) => brief.id === selectedBriefId) || (fetcher.data?.brief?.id === selectedBriefId ? fetcher.data.brief : null);

  useEffect(() => {
    const response = fetcher.data;
    if (!response || response === handled.current) return;
    handled.current = response;
    if (response.error) setNotice({ tone: "error", message: response.error });
    if (response.success) setNotice({ tone: "success", message: response.success });
    if (response.preview) { setPreview(response.preview); setWorkspace("preview"); }
    if (response.intent === "save" && response.brief) { setPreview(null); setWorkspace(null); setSelectedBriefId(response.brief.id); }
    if (response.intent === "update" && response.brief) { setEditing(false); setSelectedBriefId(response.brief.id); }
    if (response.intent === "duplicate" && response.brief) {
      duplicateKeys.current.delete(response.sourceBriefId);
      setSelectedBriefId(response.brief.id);
    }
    if (response.intent === "delete" && response.briefId) { setDeleteBrief(null); setSelectedBriefId(""); }
  }, [fetcher.data]);

  const initialSetup = useMemo(() => ({
    productId: data.selectedProductId,
    campaignObjective: "Conversions",
    targetAudience: "",
    platform: "TikTok",
    creativeFormat: "UGC testimonial",
    tone: "Authentic",
  }), [data.selectedProductId]);

  function openSetup(fromPreview = false) {
    setWorkspace("setup");
    if (!fromPreview) setPreview(null);
    setNotice(null);
  }

  function submitPreview(nextPreview = preview) {
    if (!nextPreview || pending) return;
    fetcher.submit({
      intent: "save", productId: nextPreview.setup.productId,
      sourceCreativeId: nextPreview.setup.sourceCreativeId || "",
      sourceVideoAnalysisId: nextPreview.setup.sourceVideoAnalysisId || "",
      previewJson: JSON.stringify(nextPreview), previewToken: nextPreview.previewToken,
    }, { method: "post" });
  }

  function regenerate() {
    if (!preview || pending) return;
    fetcher.submit({ intent: "generate", ...preview.setup }, { method: "post" });
  }

  function duplicateBrief(brief) {
    if (pending) return;
    let duplicateKey = duplicateKeys.current.get(brief.id);
    if (!duplicateKey) {
      duplicateKey = cryptoRandomKey();
      duplicateKeys.current.set(brief.id, duplicateKey);
    }
    fetcher.submit({ intent: "duplicate", briefId: brief.id, duplicateKey }, { method: "post" });
  }

  return (
    <div className="space-y-6">
      <header className="glass-strong rounded-3xl border border-cyan-400/15 p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Creative planning</p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl">Creative Briefs</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">Turn product context, creative analysis, and performance signals into actionable plans for your next ad.</p>
          </div>
          <button className="bp-primary-cta shrink-0 justify-center" onClick={() => openSetup()} type="button"><FilePlus2 size={18} /> Generate New Brief</button>
        </div>
      </header>

      {notice && <Notice notice={notice} onClose={() => setNotice(null)} />}

      {data.briefs.length === 0 ? (
        <div className="relative">
          <EmptyWorkspaceState title="No creative briefs yet" description="Create your first brief using a Shopify product, an analyzed video, or connected performance data." primaryText="Analyze a Video" primaryLink={withEmbeddedRouteParams("/app/video-analysis", location.search)} />
          <div className="mt-4 flex justify-center"><button className="bp-primary-cta" onClick={() => openSetup()} type="button">Generate First Brief</button></div>
        </div>
      ) : (
        <section aria-labelledby="saved-briefs-title">
          <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Library</p><h2 className="mt-1 text-xl font-semibold text-foreground" id="saved-briefs-title">Saved creative briefs</h2></div><span className="text-sm text-muted-foreground">{data.briefs.length} saved</span></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.briefs.map((brief) => <BriefCard brief={brief} key={brief.id} onDelete={setDeleteBrief} onDuplicate={duplicateBrief} onEdit={(item) => { setSelectedBriefId(item.id); setEditing(true); }} onOpen={(item) => { setSelectedBriefId(item.id); setEditing(false); }} pending={pending} />)}</div>
        </section>
      )}

      {workspace && <WorkspaceDialog analyses={data.analyses} creatives={data.creatives} fetcher={fetcher} initialSetup={preview?.setup || initialSetup} mode={workspace} onClose={() => { setWorkspace(null); setPreview(null); }} onEdit={() => setWorkspace("setup")} onRegenerate={regenerate} onSave={submitPreview} pending={pending} preview={preview} products={data.products} />}
      {selectedBrief && <DetailDialog brief={selectedBrief} editing={editing} fetcher={fetcher} onClose={() => { setSelectedBriefId(""); setEditing(false); }} onDelete={setDeleteBrief} onDuplicate={duplicateBrief} onEdit={() => setEditing(true)} pending={pending} />}
      {deleteBrief && <ConfirmDelete brief={deleteBrief} onCancel={() => setDeleteBrief(null)} onConfirm={() => fetcher.submit({ intent: "delete", briefId: deleteBrief.id }, { method: "post" })} pending={pending} />}
    </div>
  );
}

function BriefCard({ brief, onDelete, onDuplicate, onEdit, onOpen, pending }) {
  return <article className="glass flex min-h-[270px] flex-col rounded-2xl border border-slate-800/80 p-5">
    <div className="flex items-start justify-between gap-3"><StatusBadge status={brief.status} /><span className="text-xs text-slate-500">{formatDate(brief.createdAt)}</span></div>
    <h3 className="mt-4 line-clamp-2 text-lg font-semibold text-foreground">{brief.title}</h3>
    <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{brief.payload.content.mainConcept || brief.payload.content.coreAngle || "Open this brief to complete its creative direction."}</p>
    <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs"><Meta label="Product" value={brief.productTitle} /><Meta label="Objective" value={brief.campaignObjective} /><Meta label="Placement" value={brief.platform} /><Meta label="Format" value={brief.creativeFormat} /></dl>
    {(brief.payload.setup.sourceCreativeTitle || brief.payload.setup.sourceVideoAnalysisTitle) && <p className="mt-3 line-clamp-2 text-xs text-slate-500">Source: {[brief.payload.setup.sourceCreativeTitle, brief.payload.setup.sourceVideoAnalysisTitle].filter(Boolean).join(" · ")}</p>}
    <p className="mt-auto pt-4 text-xs text-slate-500">Updated {formatDate(brief.updatedAt)}</p>
    <div className="mt-3 flex flex-wrap gap-2"><CardAction icon={<FolderOpen size={14} />} label="Open" onClick={() => onOpen(brief)} /><CardAction icon={<Edit3 size={14} />} label="Edit" onClick={() => onEdit(brief)} /><CardAction disabled={pending} icon={<Copy size={14} />} label="Duplicate" onClick={() => onDuplicate(brief)} /><CardAction danger icon={<Trash2 size={14} />} label="Delete" onClick={() => onDelete(brief)} /></div>
  </article>;
}

function WorkspaceDialog({ analyses, creatives, fetcher, initialSetup, mode, onClose, onEdit, onRegenerate, onSave, pending, preview, products }) {
  return <Dialog onClose={onClose} title={mode === "setup" ? "Generate a creative brief" : "Generated brief preview"} wide>
    <div className="mb-6 flex items-center gap-3 text-sm"><Step active={mode === "setup"} number="1" text="Brief setup" /><span className="h-px flex-1 bg-slate-800" /><Step active={mode === "preview"} number="2" text="Generated preview" /></div>
    {mode === "setup" ? <fetcher.Form className="space-y-6" method="post"><input name="intent" type="hidden" value="generate" /><SetupFields analyses={analyses} creatives={creatives} initial={initialSetup} products={products} /><div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-slate-800 bg-[#0b1220] pt-4"><button className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300" onClick={onClose} type="button">Cancel</button><button className="bp-primary-cta" disabled={pending || !products.length} type="submit">{pending ? "Generating…" : "Generate Brief"}</button></div></fetcher.Form> : <Preview brief={preview} actions={<div className="sticky bottom-0 mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-800 bg-[#0b1220] pt-4"><button className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200" disabled={pending} onClick={onEdit} type="button">Edit Inputs</button><button className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200" disabled={pending} onClick={onRegenerate} type="button">{pending ? "Working…" : "Regenerate"}</button><button className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-200" disabled={pending} onClick={onClose} type="button">Discard</button><button className="bp-primary-cta" disabled={pending} onClick={() => onSave(preview)} type="button">{pending ? "Saving…" : "Save Brief"}</button></div>} />}
  </Dialog>;
}

function SetupFields({ analyses, creatives, initial, products }) {
  return <div className="grid gap-5 md:grid-cols-2">
    <SelectField label="Shopify product" name="productId" required defaultValue={initial.productId}><option value="">Select a product</option>{products.map((item) => <option key={item.id} value={item.id}>{item.title}{item.sourceLabel ? ` · ${item.sourceLabel}` : ""}</option>)}</SelectField>
    <SelectField label="Campaign objective" name="campaignObjective" required defaultValue={initial.campaignObjective}>{OBJECTIVES.map(option)}</SelectField>
    <TextField label="Target audience" name="targetAudience" required defaultValue={initial.targetAudience} placeholder="e.g. Busy skincare shoppers, ages 25–40" />
    <SelectField label="Platform or placement" name="platform" required defaultValue={initial.platform}>{PLATFORMS.map(option)}</SelectField>
    <SelectField label="Creative format" name="creativeFormat" required defaultValue={initial.creativeFormat}>{FORMATS.map(option)}</SelectField>
    <SelectField label="Desired tone or style" name="tone" defaultValue={initial.tone}>{TONES.map(option)}</SelectField>
    <SelectField label="Source creative (optional)" name="sourceCreativeId" defaultValue={initial.sourceCreativeId || ""}><option value="">No source creative</option>{creatives.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.sourceLabel}</option>)}</SelectField>
    <SelectField label="Saved video analysis (optional)" name="sourceVideoAnalysisId" defaultValue={initial.sourceVideoAnalysisId || ""}><option value="">No saved analysis</option>{analyses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</SelectField>
    <TextField label="Product selling point" name="productSellingPoint" defaultValue={initial.productSellingPoint} placeholder="The one benefit this ad should prove" />
    <TextField label="Offer or promotion" name="offer" defaultValue={initial.offer} placeholder="e.g. 15% off this week" />
    <TextField label="Desired video length" name="desiredVideoLength" defaultValue={initial.desiredVideoLength} placeholder="e.g. 15 seconds" />
    <div className="md:col-span-2"><TextArea label="Merchant notes" name="merchantNotes" defaultValue={initial.merchantNotes} placeholder="Context the creative team should know" /></div>
    <div className="md:col-span-2"><TextArea label="Additional restrictions or instructions" name="restrictions" defaultValue={initial.restrictions} placeholder="Claims to avoid, required shots, brand rules, or platform constraints" /></div>
  </div>;
}

function DetailDialog({ brief, editing, fetcher, onClose, onDelete, onDuplicate, onEdit, pending }) {
  if (editing) return <Dialog onClose={onClose} title="Edit creative brief" wide><EditForm brief={brief} fetcher={fetcher} onCancel={onClose} pending={pending} /></Dialog>;
  return <Dialog onClose={onClose} title={brief.title} wide><div className="mb-5 flex flex-wrap items-center gap-3"><StatusBadge status={brief.status} /><span className="text-sm text-slate-400">Created {formatDate(brief.createdAt)} · Updated {formatDate(brief.updatedAt)}</span></div><Preview brief={brief.payload} /><div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4"><button className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200" onClick={onClose} type="button">Return to Creative Briefs</button><button className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200" onClick={onEdit} type="button">Edit</button><button className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200" disabled={pending} onClick={() => onDuplicate(brief)} type="button">Duplicate</button><button className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-200" onClick={() => onDelete(brief)} type="button">Delete</button></div></Dialog>;
}

function EditForm({ brief, fetcher }) {
  const content = brief.payload.content;
  return <fetcher.Form className="space-y-5" method="post"><input name="intent" type="hidden" value="update" /><input name="briefId" type="hidden" value={brief.id} /><div className="grid gap-5 md:grid-cols-2"><TextField label="Title" name="title" required defaultValue={brief.title} /><SelectField label="Status" name="status" defaultValue={brief.status}><option value="DRAFT">Draft</option><option value="READY">Ready</option></SelectField><SelectField label="Objective" name="campaignObjective" defaultValue={brief.campaignObjective}>{OBJECTIVES.map(option)}</SelectField><TextField label="Audience" name="targetAudience" defaultValue={brief.targetAudience} /><SelectField label="Platform" name="platform" defaultValue={brief.platform}>{PLATFORMS.map(option)}</SelectField><SelectField label="Format" name="creativeFormat" defaultValue={brief.creativeFormat}>{FORMATS.map(option)}</SelectField><SelectField label="Tone" name="tone" defaultValue={brief.tone}>{TONES.map(option)}</SelectField><TextField label="Merchant notes" name="merchantNotes" defaultValue={brief.merchantNotes} /></div><div className="grid gap-5 md:grid-cols-2">{EDITABLE_CONTENT.map(([key, label, list]) => <TextArea defaultValue={list ? (content[key] || []).join("\n") : content[key]} key={key} label={label} name={`content-${key}`} />)}</div><input name="contentJson" type="hidden" value={JSON.stringify(Object.fromEntries(EDITABLE_CONTENT.map(([key, , list]) => [key, list ? undefined : content[key]])))} /><EditContentSerializer /></fetcher.Form>;
}

function EditContentSerializer() {
  return <div className="flex flex-wrap justify-end gap-3 border-t border-slate-800 pt-4"><button className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300" onClick={(event) => event.currentTarget.form?.reset()} type="button">Reset</button><button className="bp-primary-cta" onClick={(event) => { const form = event.currentTarget.form; const content = {}; EDITABLE_CONTENT.forEach(([key, , list]) => { const value = form.elements[`content-${key}`]?.value || ""; content[key] = list ? value.split(/\n+/).filter(Boolean) : value; }); form.elements.contentJson.value = JSON.stringify(content); }} type="submit">Save Changes</button></div>;
}

const EDITABLE_CONTENT = [["mainConcept", "Main concept"], ["coreAngle", "Core angle"], ["hook", "Hook"], ["problem", "Problem"], ["solution", "Solution"], ["productBenefit", "Product benefit"], ["proofPoints", "Proof points (one per line)", true], ["sceneSequence", "Script or scene sequence (one per line)", true], ["visualDirection", "Visual direction"], ["onScreenText", "On-screen text (one per line)", true], ["voiceoverGuidance", "Voiceover or dialogue guidance"], ["cta", "CTA"], ["recommendedDuration", "Recommended duration"], ["platformGuidance", "Platform-specific guidance"], ["testingVariations", "Testing variations (one per line)", true]];

function Preview({ actions, brief }) {
  if (!brief) return null;
  const setup = brief.setup || {};
  const content = brief.content || {};
  return <div><div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Creative brief</p><h3 className="mt-2 text-2xl font-semibold text-white">{brief.title}</h3><p className="mt-3 text-sm leading-6 text-slate-300">{content.mainConcept}</p><dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Meta label="Product" value={setup.productTitle} /><Meta label="Audience" value={setup.targetAudience} /><Meta label="Objective" value={setup.campaignObjective} /><Meta label="Placement" value={setup.platform} /><Meta label="Format" value={setup.creativeFormat} /><Meta label="Tone" value={setup.tone} /><Meta label="Source creative" value={setup.sourceCreativeTitle} /><Meta label="Video analysis" value={setup.sourceVideoAnalysisTitle} /></dl></div><div className="mt-5 grid gap-4 md:grid-cols-2"><Section title="Core angle" value={content.coreAngle} /><Section title="Hook" value={content.hook} /><Section title="Problem" value={content.problem} /><Section title="Solution" value={content.solution} /><Section title="Product benefit" value={content.productBenefit} /><Section list title="Key proof points" value={content.proofPoints} /><Section list wide title="Script or scene sequence" value={content.sceneSequence} /><Section title="Visual direction" value={content.visualDirection} /><Section list title="On-screen text guidance" value={content.onScreenText} /><Section title="Voiceover or dialogue guidance" value={content.voiceoverGuidance} /><Section title="CTA" value={content.cta} /><Section title="Recommended duration" value={content.recommendedDuration} /><Section wide title="Platform-specific guidance" value={content.platformGuidance} /><Section list wide title="Testing variations" value={content.testingVariations} /></div><Evidence evidence={brief.evidence} missing={brief.missingDataNotes} /><div className="mt-4"><Section list title="Assumptions" value={brief.assumptions} /></div>{setup.merchantNotes && <div className="mt-4"><Section title="Merchant notes" value={setup.merchantNotes} /></div>}{actions}</div>;
}

function Evidence({ evidence = {}, missing = [] }) {
  const metrics = evidence.performanceMetrics || [];
  return <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-5"><h4 className="text-base font-semibold text-white">Evidence used for this brief</h4><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{evidence.product && <EvidenceItem label="Product context" value={`${evidence.product.title}${evidence.product.description ? ` · ${evidence.product.description}` : ""}`} />}{evidence.creative && <EvidenceItem label="Source creative" value={[evidence.creative.title, evidence.creative.hook].filter(Boolean).join(" · ")} />}{evidence.videoAnalysis && <EvidenceItem label="Saved video analysis" value={[evidence.videoAnalysis.title, evidence.videoAnalysis.summary, evidence.videoAnalysis.creativeScore != null ? `Creative score ${evidence.videoAnalysis.creativeScore}` : ""].filter(Boolean).join(" · ")} />}{metrics.map((item) => <EvidenceItem key={item.label} label={item.label} value={formatMetric(item.label, item.value)} />)}</div>{!metrics.length && <p className="mt-4 text-sm text-slate-400">No connected performance data was available. This brief was generated from product context and creative-analysis inputs.</p>}{missing.filter((message) => !message.startsWith("No connected performance")).map((message) => <p className="mt-2 text-sm text-slate-500" key={message}>{message}</p>)}</section>;
}

function ConfirmDelete({ brief, onCancel, onConfirm, pending }) { return <Dialog onClose={onCancel} title="Delete creative brief?"><p className="text-sm leading-6 text-slate-300">Delete “{brief.title}”? The product, source creative, video analysis, campaign records, and other briefs will stay intact.</p><div className="mt-6 flex justify-end gap-3"><button className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200" disabled={pending} onClick={onCancel} type="button">Cancel</button><button className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={pending} onClick={onConfirm} type="button">{pending ? "Deleting…" : "Delete Brief"}</button></div></Dialog>; }
function Dialog({ children, onClose, title, wide = false }) { return <div aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5" role="dialog"><section className={`max-h-[94vh] w-full ${wide ? "max-w-6xl" : "max-w-xl"} overflow-y-auto rounded-2xl border border-white/15 bg-[#0b1220] p-5 shadow-2xl sm:p-7`}><div className="mb-5 flex items-start justify-between gap-4"><h2 className="text-xl font-semibold text-white sm:text-2xl">{title}</h2><button aria-label={`Close ${title}`} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:text-white" onClick={onClose} type="button"><X size={18} /></button></div>{children}</section></div>; }
function Notice({ notice, onClose }) { return <div className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === "error" ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"}`} role="status"><span>{notice.message}</span><button aria-label="Dismiss notification" onClick={onClose} type="button"><X size={16} /></button></div>; }
function Section({ list = false, title, value, wide = false }) { if (!value || (Array.isArray(value) && !value.length)) return null; return <section className={`rounded-xl border border-slate-800 bg-slate-950/40 p-4 ${wide ? "md:col-span-2" : ""}`}><h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{title}</h4>{list ? <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">{value.map((item, index) => <li className="flex gap-2" key={`${item}-${index}`}><span className="text-cyan-400">•</span><span>{item}</span></li>)}</ul> : <p className="mt-3 text-sm leading-6 text-slate-300">{value}</p>}</section>; }
function EvidenceItem({ label, value }) { if (!value) return null; return <div className="rounded-xl border border-slate-800 p-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-2 text-sm text-slate-300">{value}</p></div>; }
function StatusBadge({ status }) { const ready = status === "READY"; return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${ready ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}>{ready ? "Ready" : "Draft"}</span>; }
function Step({ active, number, text }) { return <span className={`flex items-center gap-2 font-semibold ${active ? "text-cyan-200" : "text-slate-500"}`}><span className={`grid h-7 w-7 place-items-center rounded-full border ${active ? "border-cyan-400/50 bg-cyan-400/10" : "border-slate-700"}`}>{number}</span>{text}</span>; }
function CardAction({ danger = false, disabled, icon, label, onClick }) { return <button className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${danger ? "border-red-500/25 text-red-200 hover:bg-red-500/10" : "border-slate-700 text-slate-300 hover:border-cyan-400/40 hover:text-white"}`} disabled={disabled} onClick={onClick} type="button">{icon}{label}</button>; }
function Meta({ label, value }) { if (!value) return null; return <div><dt className="text-slate-500">{label}</dt><dd className="mt-0.5 line-clamp-2 font-medium text-slate-300">{value}</dd></div>; }
function TextField({ defaultValue = "", label, name, placeholder, required = false }) { return <label className="block text-sm font-semibold text-slate-200">{label}<input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3.5 py-3 text-sm text-white outline-none focus:border-cyan-400" defaultValue={defaultValue || ""} name={name} placeholder={placeholder} required={required} /></label>; }
function TextArea({ defaultValue = "", label, name, placeholder }) { return <label className="block text-sm font-semibold text-slate-200">{label}<textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3.5 py-3 text-sm text-white outline-none focus:border-cyan-400" defaultValue={defaultValue || ""} name={name} placeholder={placeholder} /></label>; }
function SelectField({ children, defaultValue = "", label, name, required = false }) { return <label className="block text-sm font-semibold text-slate-200">{label}<select className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3.5 py-3 text-sm text-white outline-none focus:border-cyan-400" defaultValue={defaultValue || ""} name={name} required={required}>{children}</select></label>; }

function option(value) { return <option key={value} value={value}>{value}</option>; }
function parseObject(value) { try { const parsed = JSON.parse(String(value || "{}")); return parsed && typeof parsed === "object" ? parsed : {}; } catch { return {}; } }
function readSetupInput(formData) { return Object.fromEntries(["title", "campaignObjective", "targetAudience", "platform", "creativeFormat", "tone", "merchantNotes", "productSellingPoint", "offer", "desiredVideoLength", "restrictions"].map((key) => [key, String(formData.get(key) || "").trim()])); }
function toProductOption(product) { return { ...product, id: String(product.id), title: product.title || product.productName || "Product", sourceLabel: product.sourceLabel || (product.source === "shopify" ? "Shopify product" : "Product context") }; }
function toCreativeOption(creative) { return { id: creative.id, title: creative.title || creative.creativeTitle || "Creative", sourceLabel: creative.sourceLabel || creative.platform || "Creative Library" }; }
function toAnalysisOption(analysis) { return { id: analysis.id, title: analysis.brief || analysis.fileName || analysis.payload?.result?.display?.displayTitle || "Saved video analysis" }; }
function toBriefView(record) { return { id: record.id, title: record.title || record.payload?.title || "Creative brief", status: record.status || record.payload?.status || "DRAFT", productId: record.productId, productTitle: record.productTitle || record.payload?.setup?.productTitle, sourceCreativeId: record.sourceCreativeId, sourceVideoAnalysisId: record.sourceVideoAnalysisId, campaignObjective: record.campaignObjective || record.payload?.setup?.campaignObjective, targetAudience: record.targetAudience || record.payload?.setup?.targetAudience, platform: record.platform || record.payload?.setup?.platform, creativeFormat: record.creativeFormat || record.payload?.setup?.creativeFormat, tone: record.tone || record.payload?.setup?.tone, merchantNotes: record.merchantNotes || record.payload?.setup?.merchantNotes, payload: record.payload, createdAt: record.createdAt, updatedAt: record.updatedAt }; }
function formatDate(value) { if (!value) return "Unknown"; return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)); }
function formatMetric(label, value) { const number = Number(value); if (!Number.isFinite(number)) return String(value); if (["CTR", "CVR"].includes(label)) return `${number.toLocaleString()}%`; if (["Spend", "Revenue", "CPA"].includes(label)) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(number); if (label === "ROAS") return `${number.toFixed(2)}×`; return number.toLocaleString(); }
function cryptoRandomKey() { return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
