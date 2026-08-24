import assert from "node:assert/strict";
import test from "node:test";
import { applyProjectCommand, projectCommands } from "./commands.js";
import { createEmptyProject } from "./project.js";

function fixture() {
  return createEmptyProject({
    nodes: [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 100, y: 0 },
    ],
    walls: [{ id: 3, startNodeId: 1, endNodeId: 2, locked: false }],
    rooms: [{ id: 4, name: "Room", nodeIds: [1, 2], wallIds: [3] }],
    openings: [{ id: 5, wallId: 3, type: "door" }],
    objects: [{ id: 6, wallId: 3, mount: "wall" }, { id: 7, mount: "floor" }],
    electricalRoutes: [{ id: 8, fromObjectId: 6, toObjectId: 7, circuitId: null }],
  });
}

test("commands patch entities without mutating the previous project", () => {
  const before = fixture();
  const after = applyProjectCommand(before, projectCommands.patch("wall", [3], { locked: true }));
  assert.equal(before.walls[0].locked, false);
  assert.equal(after.walls[0].locked, true);
  assert.notEqual(after, before);
});

test("deleting a wall cascades through dependent geometry and service routes", () => {
  const after = applyProjectCommand(fixture(), projectCommands.remove("wall", [3]));
  assert.deepEqual(after.walls, []);
  assert.deepEqual(after.nodes, []);
  assert.deepEqual(after.rooms, []);
  assert.deepEqual(after.openings, []);
  assert.deepEqual(after.objects.map(({ id }) => id), [7]);
  assert.deepEqual(after.electricalRoutes, []);
});

test("deleting an electrical circuit unassigns devices and removes its routes", () => {
  const before = createEmptyProject({
    electricalCircuits: [{ id: 1, name: "Sockets" }],
    objects: [{ id: 2, circuitId: 1 }],
    electricalRoutes: [{ id: 3, fromObjectId: 2, toObjectId: 2, circuitId: 1 }],
  });
  const after = applyProjectCommand(before, projectCommands.remove("electricalCircuit", [1]));
  assert.equal(after.objects[0].circuitId, null);
  assert.deepEqual(after.electricalRoutes, []);
});

test("deleting a room unassigns furniture and hosted voids", () => {
  const before = createEmptyProject({
    rooms: [
      { id: 1, name: "Kitchen", nodeIds: [], wallIds: [] },
      { id: 2, name: "Column", classification: "void", hostRoomId: 1, nodeIds: [], wallIds: [] },
    ],
    objects: [{ id: 3, mount: "floor", roomId: 1 }],
  });
  const after = applyProjectCommand(before, projectCommands.remove("room", [1]));
  assert.equal(after.rooms[0].hostRoomId, null);
  assert.equal(after.objects[0].roomId, null);
});

test("unknown command and layer names fail loudly", () => {
  assert.throws(() => applyProjectCommand(fixture(), { type: "mystery" }), /Unknown project command/);
  assert.throws(
    () => applyProjectCommand(fixture(), projectCommands.setLayer("roof", { visible: false })),
    /Unknown layer/,
  );
});
