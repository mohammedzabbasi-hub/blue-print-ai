import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { removeUnexpectedDocumentChildren } from "./document-hydration.js";

describe("document hydration boundary", () => {
  it("keeps head and body while removing injected document-level siblings", () => {
    const head = fakeElement("HEAD");
    const body = fakeElement("BODY");
    const injected = fakeElement("DIV");
    const documentObject = {
      body,
      documentElement: { children: [head, body, injected] },
      head,
    };

    const removed = removeUnexpectedDocumentChildren(documentObject);

    assert.deepEqual(removed, [injected]);
    assert.equal(head.removed, false);
    assert.equal(body.removed, false);
    assert.equal(injected.removed, true);
  });

  it("is a no-op for a valid server-rendered document", () => {
    const head = fakeElement("HEAD");
    const body = fakeElement("BODY");

    assert.deepEqual(
      removeUnexpectedDocumentChildren({
        body,
        documentElement: { children: [head, body] },
        head,
      }),
      [],
    );
  });
});

function fakeElement(tagName) {
  return {
    removed: false,
    tagName,
    remove() {
      this.removed = true;
    },
  };
}
