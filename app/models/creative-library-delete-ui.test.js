import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const routePath = new URL("../routes/app.creative-library.jsx", import.meta.url);

describe("Creative Library delete UI", () => {
  it("submits one confirmed delete with pending, success, error, and modal cleanup UI", async () => {
    const source = await readFile(routePath, "utf8");

    assert.match(source, /function CreativeDeleteControl/);
    assert.match(source, /name="intent" type="hidden" value="deleteCreative"/);
    assert.match(source, /onSubmit=\{\(event\) => \{/);
    assert.match(source, /submittedRef\.current = true/);
    assert.match(source, /disabled=\{deleting\}/);
    assert.match(source, /Deleting…/);
    assert.match(source, /role="alert"/);
    assert.match(source, /Creative removed from this workspace\./);
    assert.match(source, /<CreativeDetailsModal[\s\S]*onDeleted=\{markCreativeDeleted\}/);
    assert.match(source, /String\(selectedCreativeId\) === String\(creative\.id\)/);
  });

  it("matches a completed response to the submitted record instead of stale fetcher data", async () => {
    const source = await readFile(routePath, "utf8");

    assert.match(source, /deleteFetcher\.state !== "idle" \|\| !submittedRef\.current/);
    assert.match(source, /deletedRecordId\) === String\(creative\.recordId\)/);
    assert.match(source, /deletedRecordType === creative\.recordType/);
    assert.match(source, /deletedCreativeKeys\.includes\(creative\.deletionKey\)/);
  });
});
