import test from "node:test";
import assert from "node:assert/strict";
import { nodeIsConstrained, projectToSegment, snapAngle, wallKey } from "./geometry.js";

test("snapAngle snaps to 15 degree increments while preserving length", () => {
  const point = snapAngle({ x: 0, y: 0 }, { x: 10, y: 4 });
  const angle = (Math.atan2(point.y, point.x) * 180) / Math.PI;
  assert.ok(Math.abs(angle - 15) < 1e-9);
  assert.ok(Math.abs(Math.hypot(point.x, point.y) - Math.hypot(10, 4)) < 1e-9);
});

test("projectToSegment clamps projections to wall endpoints", () => {
  assert.deepEqual(projectToSegment({ x: -4, y: 2 }, { x: 0, y: 0 }, { x: 10, y: 0 }).point, { x: 0, y: 0 });
  assert.deepEqual(projectToSegment({ x: 12, y: 2 }, { x: 0, y: 0 }, { x: 10, y: 0 }).point, { x: 10, y: 0 });
});

test("a node attached to a locked wall is constrained", () => {
  const walls = [{ id: 4, startNodeId: 1, endNodeId: 2, locked: true }];
  assert.equal(nodeIsConstrained(1, walls), true);
  assert.equal(nodeIsConstrained(3, walls), false);
  assert.equal(nodeIsConstrained(1, walls, 4), false);
});

test("wallKey is stable regardless of direction", () => {
  assert.equal(wallKey(7, 2), wallKey(2, 7));
});
