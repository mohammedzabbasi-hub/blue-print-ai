import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCsvRecords } from "./csv.server.js";

describe("parseCsvRecords", () => {
  it("parses a simple CSV into header-keyed records", () => {
    const records = parseCsvRecords("id,title,price\nprod-1,Serum,38.00\nprod-2,Cup,29.00\n");

    assert.equal(records.length, 2);
    assert.deepEqual(records[0], { id: "prod-1", title: "Serum", price: "38.00" });
    assert.equal(records[1].title, "Cup");
  });

  it("handles quoted fields with embedded commas and escaped quotes", () => {
    const records = parseCsvRecords(
      'id,notes\ncreator-1,"UGC, product demos"\ncreator-2,"Says ""hello"" on camera"\n',
    );

    assert.equal(records[0].notes, "UGC, product demos");
    assert.equal(records[1].notes, 'Says "hello" on camera');
  });

  it("normalizes header casing/spacing to snake_case keys", () => {
    const records = parseCsvRecords("Product ID, Total Views\nprod-1,1000\n");

    assert.deepEqual(records[0], { product_id: "prod-1", total_views: "1000" });
  });

  it("returns an empty array for a header-only or empty CSV", () => {
    assert.deepEqual(parseCsvRecords("id,title\n"), []);
    assert.deepEqual(parseCsvRecords(""), []);
  });
});
