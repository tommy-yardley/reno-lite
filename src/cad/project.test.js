import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyProject,
  nextProjectId,
  normaliseProject,
  parseProject,
  PROJECT_VERSION,
  serializeProject,
} from "./project.js";

test("v2 autosaves migrate to the current complete project schema", () => {
  const project = normaliseProject({
    version: 2,
    nodes: [{ id: 1, x: 0, y: 0 }],
    walls: [],
    rooms: [],
    openings: [],
    objects: [],
    unit: "metric",
  });
  assert.equal(project.version, PROJECT_VERSION);
  assert.equal(project.format, "reno-lite");
  assert.deepEqual(project.electricalCircuits, []);
  assert.equal(project.layerSettings.architecture.visible, true);
  assert.equal(nextProjectId(project), 2);
});

test("project serialisation is canonical and round-trips", () => {
  const project = createEmptyProject({ name: "Ground floor" });
  assert.deepEqual(parseProject(serializeProject(project)), project);
});

test("imports reject duplicate ids and broken references before replacing the drawing", () => {
  assert.throws(
    () =>
      normaliseProject({
        ...createEmptyProject(),
        nodes: [{ id: 1, x: 0, y: 0 }],
        walls: [{ id: 1, startNodeId: 1, endNodeId: 99 }],
      }),
    /Duplicate project id/,
  );
  assert.throws(
    () =>
      normaliseProject({
        ...createEmptyProject(),
        nodes: [{ id: 1, x: 0, y: 0 }],
        walls: [{ id: 2, startNodeId: 1, endNodeId: 99 }],
      }),
    /missing node/,
  );
});

test("projects from a newer app fail with an actionable error", () => {
  assert.throws(
    () => normaliseProject({ ...createEmptyProject(), version: PROJECT_VERSION + 1 }),
    /supports up to/,
  );
});
