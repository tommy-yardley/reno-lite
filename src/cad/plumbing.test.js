import test from "node:test";
import assert from "node:assert/strict";
import { PIPE_SYSTEMS, plumbingRoutePoints, validatePlumbing } from "./plumbing.js";

test("plumbing routes create orthogonal service paths", () => {
  assert.deepEqual(plumbingRoutePoints({ fromObjectId: 1, toObjectId: 2 }, [{ id: 1, mount: "free", x: 10, y: 20 }, { id: 2, mount: "free", x: 50, y: 70 }], [], new Map()), [{ x: 10, y: 20 }, { x: 10, y: 70 }, { x: 50, y: 70 }]);
});

test("plumbing validation reports fixtures without services", () => {
  assert.deepEqual(validatePlumbing({ objects: [{ id: 1, name: "Basin", category: "Plumbing" }], routes: [] }), ["Basin has no plumbing route."]);
});

test("UK concept pipe systems offer system-appropriate nominal diameters", () => {
  assert.deepEqual(PIPE_SYSTEMS.waste.diametersMm, [32, 40, 50, 110]);
  assert.equal(PIPE_SYSTEMS.cold.defaultDiameterMm, 15);
});
