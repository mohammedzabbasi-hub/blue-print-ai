import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import db from "../db.server.js";
import {
  DEMO_PRODUCTS,
  DEMO_WORKSPACE_RESET_MODELS,
  RESET_DEMO_WORKSPACE_INTENT,
  WORKSPACE_SETUP_MODES,
  analyzeVideoInput,
  buildActivityEvents,
  buildCreators,
  buildDataImportJobs,
  buildRecommendations,
  buildRevenueBlueprint,
  deleteWorkspaceData,
  deleteWorkspaceDataFromSettingsForm,
  getWorkspaceProfile,
  loadMerchantData,
  mergeWorkspaceProfileWithProduct,
  resetDemoWorkspace,
  resetDemoWorkspaceFromSettingsForm,
  resolveProductContext,
  saveWorkspaceProfile,
} from "./blueprint.server.js";
import {
  importPublicEngagementRows,
  listCreativePerformance,
  parsePublicEngagementCsv,
} from "./creative-performance.server.js";

const resetTestShops = new Set();
const resetTestSessionIds = new Set();

after(async () => {
  for (const shop of resetTestShops) {
    await deleteResetTestRows(shop);
  }

  if (resetTestSessionIds.size) {
    await db.session.deleteMany({
      where: {
        id: {
          in: [...resetTestSessionIds],
        },
      },
    });
  }
});

describe("BluePrintAI Shopify parity builders", () => {
  it("paginates Shopify products without silently stopping at the first page", async () => {
    const cursors = [];
    const admin = {
      async graphql(_query, options) {
        const cursor = options?.variables?.cursor || null;
        cursors.push(cursor);
        const secondPage = cursor === "page-2";
        return {
          async json() {
            return {
              data: {
                shop: {
                  currencyCode: "USD",
                  myshopifyDomain: "pagination-test.myshopify.com",
                  name: "Pagination Test",
                },
                products: {
                  nodes: [{
                    createdAt: "2026-07-01T00:00:00.000Z",
                    featuredImage: null,
                    handle: secondPage ? "second" : "first",
                    id: secondPage ? "gid://shopify/Product/2" : "gid://shopify/Product/1",
                    productType: "Test",
                    status: "ACTIVE",
                    title: secondPage ? "Second product" : "First product",
                    updatedAt: "2026-07-01T00:00:00.000Z",
                    variants: { nodes: [] },
                    vendor: "BluePrintAI Test",
                  }],
                  pageInfo: secondPage
                    ? { endCursor: null, hasNextPage: false }
                    : { endCursor: "page-2", hasNextPage: true },
                },
              },
            };
          },
        };
      },
    };

    const data = await loadMerchantData(admin, {
      shop: "pagination-test.myshopify.com",
    });

    assert.deepEqual(cursors, [null, "page-2"]);
    assert.deepEqual(data.products.map((product) => product.title), [
      "First product",
      "Second product",
    ]);
    assert.deepEqual(data.productLoad, { complete: true, count: 2, limit: 1000 });
    assert.deepEqual(data.errors, []);
  });

  it("builds creator matches from Shopify product context and saved creatives", () => {
    const savedCreative = {
      id: "creative-1",
      productId: DEMO_PRODUCTS[0].id,
      title: "Saved product demo",
      angle: "Problem-solution demo",
    };

    const creators = buildCreators(DEMO_PRODUCTS, [savedCreative], {
      includeDemo: true,
    });
    const creatorIds = creators.map((creator) => creator.id);
    const creatorHandles = creators.map((creator) => creator.handle);
    const creativeMatches = creators.filter((creator) =>
      creator.creatives.some((creative) => creative.id === savedCreative.id),
    );

    assert.equal(creators.length, 7);
    assert.deepEqual(creatorIds, [
      "maya-chen",
      "sofia-lane",
      "alina-brooks",
      "nina-patel",
      "ava-monroe",
      "jordan-reed",
      "emery-kim",
    ]);
    assert.equal(new Set(creatorHandles).size, creatorHandles.length);
    assert.equal(creativeMatches.length, 1);
    assert.equal(creativeMatches[0].id, "sofia-lane");
    assert.equal(creativeMatches[0].productTitle, DEMO_PRODUCTS[0].title);
    assert.equal(creativeMatches[0].creatives[0].href, "/app/creative-library?creativeId=creative-1");
    assert.ok(creativeMatches[0].fitScore >= 80);
  });

  it("maps Shopify import status without TikTok credentials", () => {
    const jobs = buildDataImportJobs({
      products: DEMO_PRODUCTS,
      orders: [],
      orderScopeEnabled: false,
    }, []);

    assert.equal(jobs[0].source, "Shopify catalog");
    assert.equal(jobs[1].source, "Shopify orders");
    assert.equal(jobs[1].status, "Not requested");
    assert.equal(jobs[2].href, "/app/activity-log");
  });

  it("turns product context into actionable recommendations and blueprints", () => {
    const merchantData = {
      products: DEMO_PRODUCTS,
      orders: [],
    };
    const recommendations = buildRecommendations(merchantData.products);
    const blueprint = buildRevenueBlueprint(merchantData, {
      product: merchantData.products[0],
      recommendation: recommendations[0],
    });

    assert.ok(recommendations[0].nextAction.includes(merchantData.products[0].title));
    assert.equal(blueprint.context.productId, merchantData.products[0].id);
    assert.equal(blueprint.sevenDayPlan.length, 7);
  });

  it("scores uploaded video input from file and brief signals", () => {
    const analysis = analyzeVideoInput({
      description: "Open with the problem, show the result, then tell shoppers to buy today.",
      productTitle: DEMO_PRODUCTS[0].title,
      fileName: "problem-result-demo.mp4",
      fileType: "video/mp4",
      fileSize: 4_200_000,
    });

    assert.equal(analysis.retentionRisk, "Low");
    assert.ok(analysis.hookScore >= 7);
    assert.equal(analysis.fileSignals.fileType, "video/mp4");
  });

  it("combines persisted records into a newest-first activity timeline", () => {
    const events = buildActivityEvents({
      briefs: [{
        id: "brief-1",
        productId: "product-1",
        productTitle: "Product",
        angle: "Angle",
        createdAt: "2026-06-17T12:00:00.000Z",
      }],
      requests: [{
        id: "request-1",
        type: "creator_outreach",
        status: "requested",
        createdAt: "2026-06-17T13:00:00.000Z",
      }],
    });

    assert.equal(events[0].type, "Workspace");
    assert.equal(events[1].type, "Brief");
  });

  it("defaults workspace setup to entire-store catalog context", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const shop = `setup-entire-store-${suffix}.myshopify.com`;

    resetTestShops.add(shop);

    const saved = await saveWorkspaceProfile(shop, {
      setupMode: "entire_store",
      category: "Beauty/skincare",
      creativeGoal: "Better product demos",
    });
    const products = [
      { id: "gid://shopify/Product/1", title: "First catalog product" },
      { id: "gid://shopify/Product/2", title: "Second catalog product" },
    ];

    assert.equal(saved.setupMode, "entire_store");
    assert.equal(saved.selectedProductId, "");
    assert.equal(resolveProductContext(products, saved)?.id, products[0].id);
  });

  it("saves primary product metadata without limiting catalog context", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const shop = `setup-primary-product-${suffix}.myshopify.com`;
    const products = [
      {
        id: "gid://shopify/Product/primary",
        title: "Primary Product",
        handle: "primary-product",
        vendor: "Blueprint Vendor",
        productType: "Skincare",
        featuredImage: {
          url: "https://cdn.shopify.com/primary.jpg",
          altText: "Primary product",
        },
      },
      {
        id: "gid://shopify/Product/other",
        title: "Other Product",
        handle: "other-product",
      },
    ];

    resetTestShops.add(shop);

    const profile = mergeWorkspaceProfileWithProduct(
      {
        setupMode: "primary_product",
        category: "Beauty/skincare",
      },
      products[0],
    );
    const saved = await saveWorkspaceProfile(shop, profile);

    assert.equal(saved.setupMode, "primary_product");
    assert.equal(saved.selectedProductId, products[0].id);
    assert.equal(saved.selectedProductHandle, "primary-product");
    assert.equal(saved.selectedProductVendor, "Blueprint Vendor");
    assert.equal(saved.selectedProductProductType, "Skincare");
    assert.equal(saved.selectedProductImageUrl, "https://cdn.shopify.com/primary.jpg");
    assert.equal(resolveProductContext(products, saved)?.id, products[0].id);
    assert.equal(resolveProductContext(products, saved, products[1].id)?.id, products[1].id);
  });

  it("keeps manual product context working when Shopify products are unavailable", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const shop = `setup-manual-${suffix}.myshopify.com`;

    resetTestShops.add(shop);

    const saved = await saveWorkspaceProfile(shop, {
      setupMode: "manual_product_context",
      category: "Fitness",
      mainProduct: "Resistance Band Kit",
      targetCustomer: "First-time runners",
      creativeGoal: "Better UGC briefs",
      creativeSource: "Manual ideas",
    });
    const product = resolveProductContext([], saved);

    assert.equal(saved.setupMode, "manual_product_context");
    assert.equal(product?.title, "Resistance Band Kit");
    assert.equal(product?.source, "workspace_profile");
  });

  it("defines the expected setup modes", () => {
    assert.deepEqual(WORKSPACE_SETUP_MODES, [
      "entire_store",
      "primary_product",
      "manual_product_context",
    ]);
  });
});

describe("BluePrintAI demo workspace reset", () => {
  it("deletes only current-shop workspace records and preserves Shopify sessions", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const currentShop = `reset-current-${suffix}.myshopify.com`;
    const otherShop = `reset-other-${suffix}.myshopify.com`;
    const sessionId = `offline_${currentShop}`;

    resetTestShops.add(currentShop);
    resetTestShops.add(otherShop);
    resetTestSessionIds.add(sessionId);

    await seedResetWorkspace(currentShop, sessionId);
    await seedResetWorkspace(otherShop);

    const reset = await resetDemoWorkspace(currentShop);

    assert.equal(reset.shop, currentShop);
    assert.deepEqual(
      new Set(Object.keys(reset.deleted)),
      new Set([...DEMO_WORKSPACE_RESET_MODELS, "WorkspaceSetting", "UploadedFiles"]),
    );
    assert.deepEqual(reset.preserved, ["Session"]);

    for (const modelName of DEMO_WORKSPACE_RESET_MODELS) {
      assert.equal(reset.deleted[modelName], 1);
    }
    assert.equal(reset.deleted.WorkspaceSetting, 1);

    assert.deepEqual(await countResetWorkspaceRows(currentShop), {
      adCampaignCreative: 0,
      adCampaign: 0,
      savedBrief: 0,
      videoAnalysis: 0,
      savedCreative: 0,
      revenueBlueprint: 0,
      workspaceRequest: 0,
      workspaceSetting: 0,
      activityLog: 0,
      creativePerformance: 0,
    });

    assert.deepEqual(await countResetWorkspaceRows(otherShop), {
      adCampaignCreative: 1,
      adCampaign: 1,
      savedBrief: 1,
      videoAnalysis: 1,
      savedCreative: 1,
      revenueBlueprint: 1,
      workspaceRequest: 1,
      workspaceSetting: 1,
      activityLog: 1,
      creativePerformance: 1,
    });

    const [sessionCount, settingCount] = await Promise.all([
      db.session.count({ where: { id: sessionId, shop: currentShop } }),
      db.workspaceSetting.count({ where: { shop: currentShop } }),
    ]);

    assert.equal(sessionCount, 1);
    assert.equal(settingCount, 0);
    assert.deepEqual(await getResetWorkspaceProfile(currentShop), {
      brandTone: "",
      category: "",
      creativeGoal: "",
      creativeSource: "",
      mainProduct: "",
      setupMode: "entire_store",
      selectedProductHandle: "",
      selectedProductId: "",
      selectedProductImageAlt: "",
      selectedProductImageUrl: "",
      selectedProductProductType: "",
      selectedProductVendor: "",
      skippedAt: "",
      targetCustomer: "",
    });
  });

  it("removes malformed and test creative/performance records for the reset shop", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const shop = `reset-malformed-${suffix}.myshopify.com`;

    resetTestShops.add(shop);

    await Promise.all([
      db.savedCreative.create({
        data: {
          shop,
          sourceType: "manual",
          productId: "gid://shopify/Product/reset-test",
          productTitle: "seeded blueprintai local demo",
          title: "Codex final toast smoke",
          angle: "Codex toast smoke",
          payloadJson: JSON.stringify({ creatorHandle: "@'@toastcheck" }),
        },
      }),
      db.creativePerformance.create({
        data: {
          shop,
          importKey: "codex-smoke-import",
          platform: "TikTok",
          creatorHandle: "@'@mayaglowup",
          creatorName: "Codex toast smoke",
          productName: "seeded blueprintai local demo",
          payloadJson: JSON.stringify({ source: "smoke" }),
        },
      }),
    ]);

    await resetDemoWorkspace(shop);

    const [creatives, performance] = await Promise.all([
      db.savedCreative.findMany({ where: { shop } }),
      db.creativePerformance.findMany({ where: { shop } }),
    ]);

    assert.equal(creatives.length, 0);
    assert.equal(performance.length, 0);
  });

  it("runs the settings reset submit path when confirmation is RESET", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const shop = `reset-action-${suffix}.myshopify.com`;
    const formData = new FormData();

    resetTestShops.add(shop);

    await seedResetWorkspace(shop);

    formData.set("intent", RESET_DEMO_WORKSPACE_INTENT);
    formData.set("confirmation", "RESET");

    const result = await resetDemoWorkspaceFromSettingsForm(shop, formData);

    assert.equal(result.resetSuccess, "Demo workspace data was reset for this Shopify store.");
    assert.equal(result.reset.shop, shop);
    assert.equal(result.reset.deleted.SavedCreative, 1);
    assert.equal(result.reset.deleted.CreativePerformance, 1);
    assert.equal(result.reset.deleted.WorkspaceSetting, 1);
    assert.equal(await db.savedCreative.count({ where: { shop } }), 0);
    assert.equal(await db.creativePerformance.count({ where: { shop } }), 0);
    assert.equal(await db.workspaceSetting.count({ where: { shop } }), 0);
    assert.equal((await getResetWorkspaceProfile(shop)).mainProduct, "");
  });

  it("returns a visible reset error when confirmation is not RESET", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const shop = `reset-action-rejected-${suffix}.myshopify.com`;
    const formData = new FormData();

    resetTestShops.add(shop);

    await seedResetWorkspace(shop);

    formData.set("intent", RESET_DEMO_WORKSPACE_INTENT);
    formData.set("confirmation", "reset");

    const result = await resetDemoWorkspaceFromSettingsForm(shop, formData);

    assert.equal(result.resetError, "Type RESET to confirm the workspace reset.");
    assert.equal(await db.savedCreative.count({ where: { shop } }), 1);
    assert.equal(await db.creativePerformance.count({ where: { shop } }), 1);
    assert.equal(await db.workspaceSetting.count({ where: { shop } }), 1);
  });

  it("deletes local uploaded video files for the reset shop", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const shop = `reset-files-${suffix}.myshopify.com`;
    const safeShop = shop.toLowerCase();
    const uploadDir = resolve("public", "uploads", "video-analysis", safeShop);
    const uploadPath = resolve(uploadDir, "reset-test-upload.mp4");

    resetTestShops.add(shop);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(uploadPath, "reset-test-video");
    await seedResetWorkspace(shop);

    const reset = await resetDemoWorkspace(shop);

    assert.equal(reset.deleted.UploadedFiles, 1);
    await assert.rejects(readFile(uploadPath), { code: "ENOENT" });
  });

  it("does not return hardcoded demo creators or recommendations by default", () => {
    assert.deepEqual(buildCreators([], []), []);
    assert.deepEqual(
      buildCreators(DEMO_PRODUCTS, [
        { id: "merchant-creative", productId: DEMO_PRODUCTS[0].id },
      ]),
      [],
    );
    assert.deepEqual(buildRecommendations([]), []);
    assert.ok(buildCreators(DEMO_PRODUCTS, [], { includeDemo: true }).length > 0);
    assert.ok(buildRecommendations([], { includeDemo: true }).length > 0);
  });

  it("deletes private uploaded media with workspace data", async () => {
    const shop = `delete-workspace-${Date.now()}.myshopify.com`;
    const uploadDir = resolve(".data", "private-media", shop, "video-analysis");
    const uploadPath = resolve(uploadDir, "private-test.mp4");
    resetTestShops.add(shop);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(uploadPath, "private-test-video");
    await db.workspaceSetting.create({ data: { shop, key: "test", value: "true" } });

    await deleteWorkspaceData(shop);

    await assert.rejects(readFile(uploadPath), { code: "ENOENT" });
    assert.equal(await db.workspaceSetting.count({ where: { shop } }), 0);
  });

  it("requires exact DELETE confirmation for merchant data deletion", async () => {
    const shop = `delete-confirmation-${Date.now()}.myshopify.com`;
    const formData = new FormData();
    resetTestShops.add(shop);
    await db.workspaceSetting.create({ data: { shop, key: "test", value: "true" } });

    formData.set("confirmation", "delete");
    const rejected = await deleteWorkspaceDataFromSettingsForm(shop, formData);

    assert.equal(rejected.deletionError, "Type DELETE to confirm data deletion.");
    assert.equal(await db.workspaceSetting.count({ where: { shop } }), 1);
  });

  it("deletes only the authenticated shop workspace and preserves its Shopify session", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const shop = `delete-scope-${suffix}.myshopify.com`;
    const otherShop = `delete-scope-other-${suffix}.myshopify.com`;
    const sessionId = `delete-scope-session-${suffix}`;
    const formData = new FormData();
    resetTestShops.add(shop);
    resetTestShops.add(otherShop);
    resetTestSessionIds.add(sessionId);
    await seedResetWorkspace(shop, sessionId);
    await seedResetWorkspace(otherShop);
    await db.adPlatformConnection.create({
      data: {
        id: `google-connection-${suffix}`,
        shop,
        platform: "google_ads",
        encryptedAccessToken: "encrypted-test-token",
      },
    });

    formData.set("confirmation", "DELETE");
    const result = await deleteWorkspaceDataFromSettingsForm(shop, formData);

    assert.equal(result.deletion.shop, shop);
    assert.equal(result.deletionSuccess, "BluePrintAI data was deleted for this Shopify store.");
    assert.deepEqual(await countResetWorkspaceRows(shop), {
      adCampaign: 0,
      adCampaignCreative: 0,
      activityLog: 0,
      creativePerformance: 0,
      revenueBlueprint: 0,
      savedBrief: 0,
      savedCreative: 0,
      videoAnalysis: 0,
      workspaceRequest: 0,
      workspaceSetting: 0,
    });
    assert.equal(await db.adPlatformConnection.count({ where: { shop } }), 0);
    assert.equal(await db.session.count({ where: { id: sessionId, shop } }), 1);
    assert.equal(await db.savedCreative.count({ where: { shop: otherShop } }), 1);
    assert.equal(await db.workspaceSetting.count({ where: { shop: otherShop } }), 1);
  });

  it("lists persisted CreativePerformance rows without demo fallback rows", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const shop = `reset-performance-${suffix}.myshopify.com`;

    resetTestShops.add(shop);

    const empty = await listCreativePerformance({ shop });

    assert.equal(empty.records.length, 0);
    assert.equal(empty.hasDemoPerformanceData, false);

    await db.creativePerformance.create({
      data: {
        shop,
        importKey: `real-import-${suffix}`,
        platform: "TikTok Ads",
        creatorHandle: "@realcreator",
        creatorName: "Real Creator",
        productName: "Real Product",
        impressions: 1000,
        clicks: 25,
        payloadJson: JSON.stringify({ source: "test" }),
        sourceRecordType: "public_engagement_import",
      },
    });

    const persisted = await listCreativePerformance({ shop });

    assert.equal(persisted.records.length, 1);
    assert.equal(persisted.records[0].creatorHandle, "@realcreator");
    assert.equal(persisted.records[0].importSource, "public_engagement_import");
  });

  it("keeps the reset button on Settings and out of non-settings app pages", async () => {
    const routeDir = resolve("app/routes");
    const settingsSource = await readFile(
      resolve(routeDir, "app.settings.jsx"),
      "utf8",
    );
    const nonSettingsRoutes = [
      "app._index.jsx",
      "app.creative-library.jsx",
      "app.data-import.jsx",
      "app.video-analysis.jsx",
      "app.ad-briefs.jsx",
      "app.recommendations.jsx",
      "app.revenue-blueprint.jsx",
      "app.creators.jsx",
    ];

    assert.match(settingsSource, /Reset Demo Workspace/);
    assert.match(settingsSource, /<Form method="post"/);
    assert.match(settingsSource, /name="intent"[\s\S]*type="hidden"[\s\S]*value=\{RESET_DEMO_WORKSPACE_INTENT\}/);
    assert.match(settingsSource, /name="confirmation"[\s\S]*type="hidden"[\s\S]*value=\{resetConfirmation\}/);
    assert.match(settingsSource, /type="submit"/);
    assert.match(settingsSource, /loadShopifyRouteContext\(request\)/);
    assert.match(settingsSource, /resetConfirmation !== "RESET"/);

    for (const route of nonSettingsRoutes) {
      const source = await readFile(resolve(routeDir, route), "utf8");

      assert.doesNotMatch(source, /Reset Demo Workspace/);
    }
  });

  it("renders full-store setup mode controls on onboarding and settings", async () => {
    const routeDir = resolve("app/routes");
    const onboardingSource = await readFile(
      resolve(routeDir, "app.onboarding.jsx"),
      "utf8",
    );
    const settingsSource = await readFile(
      resolve(routeDir, "app.settings.jsx"),
      "utf8",
    );

    for (const source of [onboardingSource, settingsSource]) {
      assert.match(source, /name="setupMode"/);
      assert.match(source, /Use entire store/);
      assert.match(source, /Choose a primary product/);
      assert.match(source, /Enter product context manually/);
      assert.match(source, /BluePrintAI loads Shopify catalog context using safe pagination/);
      assert.match(source, /1,000 of the most recently updated products/);
      assert.match(source, /Recommended\. BluePrintAI will use[\s\S]*connected Shopify catalog/);
      assert.match(source, /The rest of the store will still remain available/);
      assert.match(source, /Shopify products could not be loaded/);
    }
  });

  it("renders a local Clear preview control next to the unified import action", async () => {
    const source = await readFile(
      resolve("app/routes", "app.data-import.jsx"),
      "utf8",
    );
    const importButtonIndex = source.indexOf("Import creative records");
    const clearButtonIndex = source.indexOf("Clear preview");

    assert.ok(importButtonIndex > 0);
    assert.ok(clearButtonIndex > importButtonIndex);
    assert.match(source, /function clearImportPreview\(\)/);
    assert.match(source, /setPreviewCleared\(true\)/);
    assert.match(source, /setClearMessage\("Import preview cleared\. No rows were saved\."\)/);
    assert.match(source, /type="button"[\s\S]*Clear preview/);
    assert.doesNotMatch(source, /clearImportPreview["'][\s\S]*importPublicEngagementRows/);
  });

  it("accepts video_url and persists playable imported creative video paths", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const shop = `import-video-url-${suffix}.myshopify.com`;
    const videoPath = "/uploads/creative-library/blueprintai-test-store.myshopify.com/example.mp4";
    const csv = [
      "creative_id,platform,creative_name,creator_handle,product_name,date,video_url,views,likes,comments,shares",
      `video-url-1,TikTok Ads,Playable video import,@videoimport,Video Product,2026-06-25,${videoPath},100,10,2,1`,
    ].join("\n");

    resetTestShops.add(shop);

    const preview = parsePublicEngagementCsv(csv);
    assert.equal(preview.rows[0].record.videoUrl, videoPath);

    const result = await importPublicEngagementRows({ csvText: csv, shop });
    assert.equal(result.ok, true);
    assert.equal(result.summary.created, 1);

    const [savedCreative, performanceRecord, library] = await Promise.all([
      db.savedCreative.findFirst({ where: { shop } }),
      db.creativePerformance.findFirst({ where: { shop } }),
      listCreativePerformance({ shop }),
    ]);

    assert.equal(JSON.parse(savedCreative.payloadJson).video_url, videoPath);
    assert.equal(performanceRecord.videoUrl, videoPath);
    assert.equal(library.records[0].videoUrl, videoPath);
  });

  it("accepts asset_url and source_url aliases for direct video files", () => {
    const assetCsv = [
      "creative_id,platform,creative_name,creator_handle,product_name,date,assetUrl,views",
      "asset-video-1,Meta Ads,Asset alias,@asset,Asset Product,2026-06-25,https://cdn.example.com/asset-demo.webm,50",
    ].join("\n");
    const sourceCsv = [
      "creative_id,platform,creative_name,creator_handle,product_name,date,source_url,views",
      "source-video-1,YouTube Ads,Source alias,@source,Source Product,2026-06-25,/uploads/creative-library/blueprintai-test-store.myshopify.com/source-demo.m4v,60",
    ].join("\n");

    assert.equal(
      parsePublicEngagementCsv(assetCsv).rows[0].record.videoUrl,
      "https://cdn.example.com/asset-demo.webm",
    );
    assert.equal(
      parsePublicEngagementCsv(sourceCsv).rows[0].record.videoUrl,
      "/uploads/creative-library/blueprintai-test-store.myshopify.com/source-demo.m4v",
    );
  });

  it("carries video_filename aliases for creative upload matching", () => {
    const csv = [
      "creative_id,videoFileName,platform,creative_name,creator_handle,product_name,date,views",
      "filename-alias-1,TTAD1.mp4,TikTok Ads,Filename alias,@alias,Alias Product,2026-06-25,80",
    ].join("\n");

    const record = parsePublicEngagementCsv(csv).rows[0].record;

    assert.equal(record.videoFilename, "TTAD1.mp4");
  });

  it("accepts daily reporting and creative launch date aliases", () => {
    for (const dateHeader of ["date", "performance_date", "reporting_date", "day"]) {
      const csv = [
        `creative_id,video_filename,platform,creative_title,creator,product,${dateHeader},first_seen_date,views,clicks,orders,revenue,spend`,
        "daily-1,TTAD1.mp4,TikTok Ads,Daily creative,@daily,Daily Product,2026-06-20,2026-06-18,100,10,2,50,20",
      ].join("\n");
      const record = parsePublicEngagementCsv(csv).rows[0].record;
      assert.equal(record.reportingDate.slice(0, 10), "2026-06-20");
      assert.equal(record.creativeLaunchDate.slice(0, 10), "2026-06-18");
    }
  });

  it("merges duplicate creative/date rows without double-counting", () => {
    const csv = [
      "creative_id,platform,creative_name,creator,product,date,views,clicks,orders,revenue,spend",
      "duplicate-day,TikTok,Duplicate daily,@daily,Daily Product,2026-06-20,100,10,2,50,20",
      "duplicate-day,TikTok,Duplicate daily,@daily,Daily Product,2026-06-20,100,10,2,50,20",
    ].join("\n");
    const preview = parsePublicEngagementCsv(csv);
    assert.equal(preview.rows.length, 1);
    assert.equal(preview.duplicateRowsMerged, 1);
    assert.equal(preview.rows[0].record.revenue, 50);
    assert.match(preview.rows[0].warnings.join(" "), /Duplicate creative\/date row merged/);
  });

  it("keeps same-day uploaded creatives distinct by creative id and filename", () => {
    const csv = [
      "creative_id,video_filename,platform,creative_name,creator,product,date,views,insight",
      "creative-a,first.mp4,TikTok,Shared title,Maya Chen,Shared Product,2026-06-25,80,First insight",
      "creative-b,second.mp4,TikTok,Shared title,Maya Chen,Shared Product,2026-06-25,90,Second insight",
    ].join("\n");
    const preview = parsePublicEngagementCsv(csv);

    assert.equal(preview.rows.length, 2);
    assert.notEqual(
      preview.rows[0].record.importKey,
      preview.rows[1].record.importKey,
    );
    assert.equal(preview.rows[0].record.creatorName, "Maya Chen");
    assert.equal(preview.rows[0].record.notes, "First insight");
  });

  it("renders creative upload import controls and source label text", async () => {
    const [dataImportSource, creativeLibrarySource] = await Promise.all([
      readFile(resolve("app/routes", "app.data-import.jsx"), "utf8"),
      readFile(resolve("app/routes", "app.creative-library.jsx"), "utf8"),
    ]);

    assert.match(dataImportSource, /Import creative performance data/);
    assert.match(dataImportSource, /Review import/);
    assert.match(dataImportSource, /Import creative records/);
    assert.equal((dataImportSource.match(/name="csvFile"/g) || []).length, 1);
    assert.match(dataImportSource, /creative_upload_performance_import/);
    assert.match(creativeLibrarySource, /Imported creative \+ performance/);
  });

  it("keeps social source URLs non-playable while preserving source links", () => {
    const csv = [
      "creative_id,platform,creative_name,creator_handle,product_name,date,source_url,thumbnail_url,views",
      "social-source-1,TikTok,Social source,@social,Social Product,2026-06-25,https://www.tiktok.com/@social/video/123,https://example.com/thumb.jpg,70",
    ].join("\n");
    const record = parsePublicEngagementCsv(csv).rows[0].record;

    assert.equal(record.videoUrl, "");
    assert.equal(record.sourceUrl, "https://www.tiktok.com/@social/video/123");
    assert.equal(record.thumbnailUrl, "https://example.com/thumb.jpg");
  });

  it("renders Creative Library media before the clean unavailable-preview fallback", async () => {
    const source = await readFile(
      resolve("app/routes", "app.creative-library.jsx"),
      "utf8",
    );
    const videoIndex = source.indexOf("<video");
    const imageIndex = source.indexOf("<img");
    const placeholderIndex = source.indexOf("Preview unavailable");

    assert.ok(videoIndex > 0);
    assert.ok(imageIndex > videoIndex);
    assert.ok(placeholderIndex > imageIndex);
    assert.match(source, /onError=\{\(\) => setPreviewFailed\(true\)\}/);
    assert.doesNotMatch(source, /GEMINI_API_KEY/);
    assert.match(source, /function isPlayableVideoUrl/);
    assert.match(source, /creative\.source_url/);
    assert.match(source, /href=\{sourceUrl\}/);
  });
});

async function seedResetWorkspace(shop, sessionId = "") {
  await deleteResetTestRows(shop);

  await db.$transaction([
    db.adCampaign.create({
      data: { id: `reset-campaign-${shop}`, shop, name: "Reset campaign", normalizedName: "reset campaign" },
    }),
    db.savedBrief.create({
      data: {
        shop,
        productId: "gid://shopify/Product/reset-brief",
        productTitle: "Reset Brief Product",
        angle: "Problem-solution brief",
        payloadJson: JSON.stringify({ title: "Old generated demo brief" }),
      },
    }),
    db.videoAnalysis.create({
      data: {
        shop,
        productId: "gid://shopify/Product/reset-review",
        productTitle: "Reset Review Product",
        fileName: "codex-smoke.mp4",
        brief: "Codex toast smoke",
        payloadJson: JSON.stringify({ review: "old saved review" }),
      },
    }),
    db.savedCreative.create({
      data: {
        id: `reset-creative-${shop}`,
        shop,
        sourceType: "manual",
        productId: "gid://shopify/Product/reset-creative",
        productTitle: "Reset Creative Product",
        title: "Codex final toast smoke",
        angle: "Codex toast smoke",
        payloadJson: JSON.stringify({ creatorHandle: "@'@toastcheck" }),
      },
    }),
    db.revenueBlueprint.create({
      data: {
        shop,
        payloadJson: JSON.stringify({ summary: "Old seeded demo blueprint" }),
      },
    }),
    db.workspaceRequest.create({
      data: {
        shop,
        type: "csv_import",
        status: "tracked",
        payloadJson: JSON.stringify({ file: "seeded blueprintai local demo.csv" }),
      },
    }),
    db.workspaceSetting.upsert({
      where: {
        shop_key: {
          shop,
          key: "analysis_depth",
        },
      },
      create: {
        shop,
        key: "analysis_depth",
        value: "deep",
      },
      update: {
        value: "deep",
      },
    }),
    db.activityLog.create({
      data: {
        shop,
        type: "creative",
        title: "Codex toast smoke",
        description: "Old test activity",
      },
    }),
    db.creativePerformance.create({
      data: {
        id: `reset-performance-${shop}`,
        shop,
        importKey: `reset-import-${shop}`,
        platform: "TikTok",
        creatorHandle: "@'@mayaglowup",
        creatorName: "Codex toast smoke",
        productName: "seeded blueprintai local demo",
        impressions: 100,
        payloadJson: JSON.stringify({ source: "smoke" }),
      },
    }),
    db.adCampaignCreative.create({
      data: {
        shop,
        campaignId: `reset-campaign-${shop}`,
        savedCreativeId: `reset-creative-${shop}`,
        creativePerformanceId: `reset-performance-${shop}`,
      },
    }),
    ...(sessionId
      ? [
          db.session.create({
            data: {
              id: sessionId,
              shop,
              state: "reset-test",
              isOnline: false,
              accessToken: "reset-test-token",
            },
          }),
        ]
      : []),
  ]);
}

async function countResetWorkspaceRows(shop) {
  const [
    adCampaignCreative,
    adCampaign,
    savedBrief,
    videoAnalysis,
    savedCreative,
    revenueBlueprint,
    workspaceRequest,
    workspaceSetting,
    activityLog,
    creativePerformance,
  ] = await Promise.all([
    db.adCampaignCreative.count({ where: { shop } }),
    db.adCampaign.count({ where: { shop } }),
    db.savedBrief.count({ where: { shop } }),
    db.videoAnalysis.count({ where: { shop } }),
    db.savedCreative.count({ where: { shop } }),
    db.revenueBlueprint.count({ where: { shop } }),
    db.workspaceRequest.count({ where: { shop } }),
    db.workspaceSetting.count({ where: { shop } }),
    db.activityLog.count({ where: { shop } }),
    db.creativePerformance.count({ where: { shop } }),
  ]);

  return {
    adCampaignCreative,
    adCampaign,
    savedBrief,
    videoAnalysis,
    savedCreative,
    revenueBlueprint,
    workspaceRequest,
    workspaceSetting,
    activityLog,
    creativePerformance,
  };
}

async function getResetWorkspaceProfile(shop) {
  const profile = await getWorkspaceProfile(shop);

  delete profile.completedAt;
  delete profile.updatedAt;

  return profile;
}

async function deleteResetTestRows(shop) {
  await db.$transaction([
    db.adCampaignCreative.deleteMany({ where: { shop } }),
    db.adCampaign.deleteMany({ where: { shop } }),
    db.savedBrief.deleteMany({ where: { shop } }),
    db.videoAnalysis.deleteMany({ where: { shop } }),
    db.savedCreative.deleteMany({ where: { shop } }),
    db.revenueBlueprint.deleteMany({ where: { shop } }),
    db.workspaceRequest.deleteMany({ where: { shop } }),
    db.workspaceSetting.deleteMany({ where: { shop } }),
    db.activityLog.deleteMany({ where: { shop } }),
    db.creativePerformance.deleteMany({ where: { shop } }),
  ]);
}
