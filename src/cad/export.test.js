import test from "node:test";
import assert from "node:assert/strict";
import { buildCadDxf, buildCadSvg, buildContractorScheduleCsv, buildContractorScheduleSvg, contractorScheduleRows, parseProject, serializeProject } from "./export.js";
import { createEmptyProject } from "./project.js";
import { buildRenderModel } from "./renderModel.js";

const project = createEmptyProject({
  renovationView: "proposed",
  nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 120, y: 0 }],
  walls: [{ id: 3, startNodeId: 1, endNodeId: 2, thicknessInches: 4.5, locked: true }],
  rooms: [],
  openings: [{ id: 4, wallId: 3, type: "door", t: 0.5, widthInches: 36 }],
  objects: [{ id: 5, kind: "socket", name: "Socket", category: "Electrical", mount: "wall", wallId: 3, t: 0.25 }],
  unit: "imperial", referenceImage: { src: "secret-reference-data" },
});

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

test("room and void geometry remains explicit in drawing exports", () => {
  const spacedProject = { ...project, nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 100, y: 0 }, { id: 6, x: 100, y: 100 }, { id: 7, x: 0, y: 100 }], rooms: [{ id: 8, name: "Living", classification: "room", nodeIds: [1, 2, 6, 7], wallIds: [] }, { id: 9, name: "Chimney", classification: "void", hostRoomId: 8, nodeIds: [1, 2, 6], wallIds: [] }] };
  assert.match(buildCadSvg(spacedProject), /VOID/);
  assert.match(buildCadSvg(spacedProject), /m²/);
  assert.match(buildCadDxf(spacedProject), /VOIDS/);
  assert.match(buildCadDxf(spacedProject), /ROOMS/);
});

test("hidden layers are omitted from clean SVG and DXF exports", () => {
  const hidden = { ...project, layerSettings: { architecture: { visible: true }, electrical: { visible: false } } };
  assert.doesNotMatch(buildCadSvg(hidden), />S<\/text>/);
  assert.doesNotMatch(buildCadDxf(hidden), /ELECTRICAL/);
  const reopened = parseProject(serializeProject(hidden));
  assert.deepEqual(reopened.layerSettings.electrical, { visible: false, locked: false });
  assert.equal(reopened.layerSettings.architecture.visible, true);
});

test("electrical wiring routes survive project and discipline exports", () => {
  const wired = createEmptyProject({ ...project, objects: [{ id: 5, kind: "ceilingLight", name: "Light", category: "Lighting", mount: "free", x: 20, y: 20 }, { id: 6, kind: "lightSwitch", name: "Switch", category: "Electrical", mount: "free", x: 80, y: 50 }], electricalCircuits: [{ id: 7, name: "Lighting", colour: "#ff0000" }], electricalRoutes: [{ id: 8, fromObjectId: 5, toObjectId: 6, circuitId: 7 }] });
  assert.match(buildCadSvg(wired), /#ff0000/);
  assert.match(buildCadDxf(wired), /ELECTRICAL_WIRING/);
  assert.deepEqual(parseProject(serializeProject(wired)), wired);
});

test("plumbing services preserve system and diameter in project exports", () => {
  const piped = createEmptyProject({ ...project, objects: [{ id: 5, kind: "basin", name: "Basin", category: "Plumbing", mount: "free", x: 20, y: 20 }, { id: 6, kind: "stopcock", name: "Stopcock", category: "Plumbing", mount: "free", x: 80, y: 50 }], plumbingRoutes: [{ id: 7, fromObjectId: 5, toObjectId: 6, system: "cold", diameterMm: 15 }] });
  assert.match(buildCadSvg(piped), /#2E86C1/i);
  assert.match(buildCadDxf(piped), /PLUMBING_COLD/);
  assert.deepEqual(parseProject(serializeProject(piped)), piped);
});

test("unplaced procurement items remain in editable project files", () => {
  const specified = { ...project, shoppingItems: [{ id: 10, name: "Paint", quantity: 3, unitPricePence: 4200 }] };
  assert.deepEqual(parseProject(serializeProject(specified)), specified);
});

test("SVG entity output has parity with the shared render model", () => {
  const model = buildRenderModel(project);
  const svg = buildCadSvg(project);
  assert.equal((svg.match(/data-entity="wall"/g) || []).length, model.walls.length);
  assert.equal((svg.match(/data-entity="door"/g) || []).length, model.openings.length);
  assert.equal((svg.match(/data-entity="object"/g) || []).length, model.objects.length);
});

test("contractor schedules include metric wall and opening dimensions", () => {
  const rows = contractorScheduleRows(project);
  assert.ok(rows.some((row) => row.schedule === "Walls" && /mm/.test(row.size)));
  assert.ok(rows.some((row) => row.schedule === "Doors" && row.size === "914 mm"));
  assert.match(buildContractorScheduleCsv(project), /Schedule,Reference,Item/);
  assert.match(buildContractorScheduleSvg(project), /contractor schedules/);
});
