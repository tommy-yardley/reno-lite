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
