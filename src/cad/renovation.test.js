import assert from "node:assert/strict";
import test from "node:test";
import { renovationAppearance, visibleInRenovationView } from "./renovation.js";

test("existing and proposed views hide the opposite renovation work", () => {
  assert.equal(visibleInRenovationView({ renovationStatus: "proposed" }, "existing"), false);
  assert.equal(visibleInRenovationView({ renovationStatus: "demolish" }, "proposed"), false);
  assert.equal(visibleInRenovationView({ renovationStatus: "existing" }, "proposed"), true);
});

test("changes view dims retained work and highlights removals", () => {
  assert.equal(renovationAppearance({ renovationStatus: "existing" }, "changes").opacity, 0.24);
  assert.equal(renovationAppearance({ renovationStatus: "demolish" }, "changes").colour, "#B2483A");
});
