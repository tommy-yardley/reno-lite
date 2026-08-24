import test from "node:test";
import assert from "node:assert/strict";
import { CIRCUIT_PRESETS, electricalRoutePoints, validateElectrical } from "./electrical.js";

test("electrical routes create an orthogonal wiring path", () => {
  const points = electricalRoutePoints({ fromObjectId: 1, toObjectId: 2 }, [{ id: 1, mount: "free", x: 10, y: 20 }, { id: 2, mount: "free", x: 60, y: 80 }], [], new Map());
  assert.deepEqual(points, [{ x: 10, y: 20 }, { x: 60, y: 20 }, { x: 60, y: 80 }]);
});

test("electrical validation reports unassigned and uncontrolled devices", () => {
  const warnings = validateElectrical({ objects: [{ id: 1, kind: "lightSwitch", name: "Switch", category: "Electrical" }], circuits: [], routes: [] });
  assert.equal(warnings.length, 2);
});

test("UK concept circuit presets use common protective-device ratings", () => {
  assert.equal(CIRCUIT_PRESETS.lighting.ratingAmps, 6);
  assert.equal(CIRCUIT_PRESETS.socketsRing.ratingAmps, 32);
  assert.equal(CIRCUIT_PRESETS.socketsRadial.ratingAmps, 20);
});
