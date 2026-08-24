import test from "node:test";
import assert from "node:assert/strict";
import { nodeIsConstrained, objectFootprint, openingSpan, pointInPolygon, polygonArea, polygonsIntersect, projectToSegment, segmentIntersection, snapAngle, snapDegrees, validateCadGraph, validateDesignLayout, wallAngleDegrees, wallKey } from "./geometry.js";

test("snapAngle snaps to 15 degree increments while preserving length", () => {
  const point = snapAngle({ x: 0, y: 0 }, { x: 10, y: 4 });
  const angle = (Math.atan2(point.y, point.x) * 180) / Math.PI;
  assert.ok(Math.abs(angle - 15) < 1e-9);
  assert.ok(Math.abs(Math.hypot(point.x, point.y) - Math.hypot(10, 4)) < 1e-9);
});

test("wall angles normalise and snap to exact 15 degree bearings", () => {
  assert.equal(wallAngleDegrees({ x: 0, y: 0 }, { x: 0, y: -10 }), 270);
  assert.equal(snapDegrees(82), 75);
  assert.equal(snapDegrees(-2), 0);
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

test("segmentIntersection returns the junction position on both walls", () => {
  const hit = segmentIntersection({ x: 0, y: 50 }, { x: 100, y: 50 }, { x: 50, y: 0 }, { x: 50, y: 100 });
  assert.deepEqual(hit.point, { x: 50, y: 50 });
  assert.equal(hit.t, 0.5);
  assert.equal(hit.u, 0.5);
});

test("rotated furniture footprints support containment and overlap checks", () => {
  const footprint = objectFootprint({ x: 50, y: 50, widthInches: 40, depthInches: 20, rotation: 90 });
  assert.equal(pointInPolygon({ x: 50, y: 50 }, footprint), true);
  assert.equal(polygonsIntersect(footprint, objectFootprint({ x: 55, y: 55, widthInches: 10, depthInches: 10, rotation: 0 })), true);
  assert.equal(polygonsIntersect(footprint, objectFootprint({ x: 100, y: 100, widthInches: 10, depthInches: 10, rotation: 0 })), false);
});

test("layout validation flags furniture collisions and room escapes", () => {
  const result = validateDesignLayout({
    nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 100, y: 0 }, { id: 3, x: 100, y: 100 }, { id: 4, x: 0, y: 100 }],
    walls: [], openings: [], rooms: [{ id: 5, nodeIds: [1, 2, 3, 4] }],
    objects: [
      { id: 6, name: "Table", mount: "floor", x: 40, y: 40, widthInches: 30, depthInches: 30, rotation: 0 },
      { id: 7, name: "Chair", mount: "floor", x: 50, y: 40, widthInches: 20, depthInches: 20, rotation: 0 },
      { id: 8, name: "Sofa", mount: "floor", x: 100, y: 50, widthInches: 30, depthInches: 30, rotation: 0 },
    ],
  });
  assert.equal(result.warnings.length, 2);
  assert.deepEqual(result.objectIds.sort(), [6, 7, 8]);
});

test("layout validation detects a furnishing in a door swing", () => {
  const result = validateDesignLayout({
    nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 100, y: 0 }],
    walls: [{ id: 3, startNodeId: 1, endNodeId: 2 }],
    rooms: [],
    openings: [{ id: 4, type: "door", wallId: 3, t: 0.5, widthInches: 30, swing: 1 }],
    objects: [{ id: 5, name: "Chair", mount: "floor", x: 45, y: 12, widthInches: 18, depthInches: 18, rotation: 0 }],
  });
  assert.deepEqual(result.warnings, ["Chair obstructs a door swing."]);
  assert.deepEqual(result.objectIds, [5]);
});
