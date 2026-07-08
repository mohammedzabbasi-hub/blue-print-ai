import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const routePath = new URL("../routes/app.creative-library.jsx", import.meta.url);

describe("Creative Library delete UI", () => {
  it("opens confirmation first, then submits one matched delete request with clear UI", async () => {
    const source = await readFile(routePath, "utf8");

    assert.match(source, /onDelete=\{\(\) => openDeleteConfirmation\(creative, "card"\)\}/);
    assert.match(source, /function CreativeDeleteConfirmationModal/);
    assert.match(source, /type="button"[\s\S]*>\s*Delete\s*<\/button>/);
    assert.match(source, /formData\.set\("intent", "deleteCreative"\)/);
    assert.match(source, /formData\.set\("deleteRequestId", deleteRequestId\)/);
    assert.match(source, /deleteFetcher\.submit\(formData, \{ method: "post" \}\)/);
    assert.match(source, /disabled=\{deleting\}/);
    assert.match(source, /Deleting\.\.\./);
    assert.match(source, /role="alert"/);
    assert.match(source, /Creative deleted\./);
    assert.match(source, /<CreativeDetailsModal[\s\S]*onDelete=\{\(\) => openDeleteConfirmation\(selectedCreative, "detail-modal"\)\}/);
    assert.match(source, /String\(selectedCreativeId\) === String\(creative\.id\)/);
  });

  it("matches a completed response to the submitted record instead of stale fetcher data", async () => {
    const source = await readFile(routePath, "utf8");

    assert.match(source, /pendingDeleteRequestId/);
    assert.match(source, /response\.deleteRequestId !== pendingDeleteRequestId/);
    assert.match(source, /setPendingDeleteRequestId\(""\)/);
    assert.match(source, /setDeleteTarget\(null\)/);
  });

  it("hides duplicate logical creative cards after one successful delete", async () => {
    const source = await readFile(routePath, "utf8");

    assert.match(source, /function getCreativeDeleteTokens/);
    assert.match(source, /function creativeMatchesDeletedTokens/);
    assert.match(source, /addDeleteToken\(tokens, "media"/);
    assert.match(source, /addDeleteToken\(tokens, "fingerprint"/);
    assert.match(source, /"review-file"/);
    assert.match(source, /creativeMatchesDeletedTokens\(creative, deletedCreativeTokens\)/);
  });

  it("logs each step of the temporary delete debug flow", async () => {
    const source = await readFile(routePath, "utf8");

    assert.match(source, /card Delete is clicked/);
    assert.match(source, /Confirm delete is clicked/);
    assert.match(source, /server action received/);
    assert.match(source, /server deletion result/);
    assert.match(source, /client receives fetcher\.data/);
    assert.match(source, /UI removes\/hides the creative/);
  });
});
