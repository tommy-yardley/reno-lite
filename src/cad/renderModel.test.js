import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProject } from "./project.js";
import { buildRenderModel } from "./renderModel.js";

const project = createEmptyProject({
  nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 120, y: 0 }],
  walls: [{ id: 3, startNodeId: 1, endNodeId: 2, thicknessInches: 4.5 }],
  openings: [{ id: 4, wallId: 3, type: "window", t: 0.5, widthInches: 36 }],
  objects: [{ id: 5, kind: "socket", category: "Electrical", mount: "wall", wallId: 3, t: 0.25 }],
});

test("render model resolves shared wall, opening, and mounted-object geometry", () => {
  const model = buildRenderModel(project);
  assert.equal(model.walls[0].length, 120);
  assert.deepEqual(model.openings[0].span.start, { x: 42, y: 0 });
  assert.equal(model.objects[0].x, 30);
  assert.equal(model.objects[0].rotation, 0);
});

test("render model applies the same layer visibility used by every output", () => {
  const hidden = {
    ...project,
    layerSettings: {
      ...project.layerSettings,
      architecture: { visible: false, locked: false },
      electrical: { visible: false, locked: false },
    },
  };
  const model = buildRenderModel(hidden);
  assert.deepEqual(model.walls, []);
  assert.deepEqual(model.openings, []);
  assert.deepEqual(model.objects, []);
});

test("wall-mounted services still resolve when the architecture layer is hidden", () => {
  const hiddenArchitecture = {
    ...project,
    layerSettings: {
      ...project.layerSettings,
      architecture: { visible: false, locked: false },
    },
  };
  const model = buildRenderModel(hiddenArchitecture);
  assert.deepEqual(model.walls, []);
  assert.equal(model.objects[0].x, 30);
});

test("drawing bounds include the physical footprint of free objects", () => {
  const model = buildRenderModel(createEmptyProject({
    objects: [{ id: 1, mount: "floor", x: 500, y: 300, widthInches: 100, depthInches: 40 }],
  }));
  assert.ok(model.bounds.minX <= 450);
  assert.ok(model.bounds.minX + model.bounds.width >= 550);
});
