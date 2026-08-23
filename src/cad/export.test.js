import test from "node:test";
import assert from "node:assert/strict";
import { buildCadDxf, buildCadSvg, parseProject, serializeProject } from "./export.js";

const project = {
  nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 120, y: 0 }],
  walls: [{ id: 3, startNodeId: 1, endNodeId: 2, thicknessInches: 4.5, locked: true }],
  rooms: [],
  openings: [{ id: 4, wallId: 3, type: "door", t: 0.5, widthInches: 36 }],
  objects: [{ id: 5, kind: "socket", name: "Socket", category: "Electrical", mount: "wall", wallId: 3, t: 0.25 }],
  unit: "imperial", referenceImage: { src: "secret-reference-data" },
};

test("drawing SVG excludes the uploaded reference image", () => {
  const svg = buildCadSvg(project);
  assert.match(svg, /<svg/);
  assert.doesNotMatch(svg, /secret-reference-data/);
});

test("DXF exports real wall coordinates in inches", () => {
  const dxf = buildCadDxf(project);
  assert.match(dxf, /WALLS_LOCKED/);
  assert.match(dxf, /DIMENSIONS/);
  assert.match(dxf, /DOORS/);
  assert.match(dxf, /ELECTRICAL/);
  assert.match(dxf, /11\n120\n/);
});

test("project files round-trip editable state including the reference", () => {
  assert.deepEqual(parseProject(serializeProject(project)), project);
});
