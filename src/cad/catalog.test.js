import test from "node:test";
import assert from "node:assert/strict";
import { OBJECT_CATALOG } from "./catalog.js";

test("every renovation object declares a supported mount strategy", () => {
  const supported = new Set(["floor", "wall", "free"]);
  Object.values(OBJECT_CATALOG).forEach((item) => assert.equal(supported.has(item.mount), true, item.label));
});

test("floor furniture has positive physical dimensions", () => {
  Object.values(OBJECT_CATALOG)
    .filter((item) => item.mount === "floor")
    .forEach((item) => {
      assert.ok(item.widthInches > 0, item.label);
      assert.ok(item.depthInches > 0, item.label);
    });
});

test("UK furniture presets retain their nominal metric dimensions", () => {
  assert.deepEqual(OBJECT_CATALOG.doubleBed.standardMm, { width: 1350, depth: 1900 });
  assert.deepEqual(OBJECT_CATALOG.baseCabinet.standardMm, { width: 600, depth: 600 });
});
