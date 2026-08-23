import test from "node:test";
import assert from "node:assert/strict";
import { nodeIsConstrained, openingSpan, polygonArea, projectToSegment, snapAngle, validateCadGraph, wallKey } from "./geometry.js";

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

test("polygonArea measures room area in square drawing units", () => {
  assert.equal(polygonArea([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }]), 14400);
});

test("openingSpan centers an opening along its host wall", () => {
  const span = openingSpan({ x: 0, y: 0 }, { x: 120, y: 0 }, 0.5, 36);
  assert.deepEqual(span.start, { x: 42, y: 0 });
  assert.deepEqual(span.end, { x: 78, y: 0 });
});

test("validateCadGraph reports broken dependencies", () => {
  const warnings = validateCadGraph({
    nodes: [{ id: 1, x: 0, y: 0 }],
    walls: [{ id: 2, startNodeId: 1, endNodeId: 99 }],
    openings: [{ id: 3, type: "door", wallId: 7 }],
  });
  assert.equal(warnings.length, 2);
});
