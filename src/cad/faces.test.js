import assert from "node:assert/strict";
import test from "node:test";
import { derivePlanFaces, reconcileProjectFaces } from "./faces.js";
import { createEmptyProject } from "./project.js";

const rectangleNodes = [
  { id: 1, x: 0, y: 0 },
  { id: 2, x: 100, y: 0 },
  { id: 3, x: 100, y: 80 },
  { id: 4, x: 0, y: 80 },
];
const rectangleWalls = [
  { id: 5, startNodeId: 1, endNodeId: 2 },
  { id: 6, startNodeId: 2, endNodeId: 3 },
  { id: 7, startNodeId: 3, endNodeId: 4 },
  { id: 8, startNodeId: 4, endNodeId: 1 },
];

test("a closed wall graph produces one bounded face and ignores its exterior walk", () => {
  const faces = derivePlanFaces(rectangleNodes, rectangleWalls);
  assert.equal(faces.length, 1);
  assert.equal(faces[0].area, 8000);
  assert.deepEqual(new Set(faces[0].wallIds), new Set([5, 6, 7, 8]));
});

test("a dividing wall produces two room faces", () => {
  const nodes = [...rectangleNodes, { id: 9, x: 50, y: 0 }, { id: 10, x: 50, y: 80 }];
  const walls = [
    { id: 11, startNodeId: 1, endNodeId: 9 },
    { id: 12, startNodeId: 9, endNodeId: 2 },
    rectangleWalls[1],
    { id: 13, startNodeId: 3, endNodeId: 10 },
    { id: 14, startNodeId: 10, endNodeId: 4 },
    rectangleWalls[3],
    { id: 15, startNodeId: 9, endNodeId: 10 },
  ];
  const faces = derivePlanFaces(nodes, walls);
  assert.equal(faces.length, 2);
  assert.deepEqual(faces.map((face) => face.area), [4000, 4000]);
});

test("reconciliation preserves room metadata across a split wall", () => {
  let id = 20;
  const project = createEmptyProject({
    nodes: rectangleNodes,
    walls: rectangleWalls,
    rooms: [{
      id: 9,
      name: "Kitchen",
      type: "Kitchen",
      classification: "room",
      nodeIds: [1, 2, 3, 4],
      wallIds: [5, 6, 7, 8],
    }],
  });
  const split = {
    ...project,
    nodes: [...project.nodes, { id: 10, x: 50, y: 0 }],
    walls: [
      { id: 11, startNodeId: 1, endNodeId: 10 },
      { id: 12, startNodeId: 10, endNodeId: 2 },
      ...project.walls.slice(1),
    ],
  };
  const result = reconcileProjectFaces(split, () => id++);
  assert.equal(result.rooms.length, 1);
  assert.equal(result.rooms[0].name, "Kitchen");
  assert.equal(result.rooms[0].id, 9);
  assert.deepEqual(new Set(result.rooms[0].wallIds), new Set([11, 12, 6, 7, 8]));
});

test("reconciliation remaps furniture when two labelled faces are joined", () => {
  let id = 30;
  const nodes = [...rectangleNodes, { id: 9, x: 50, y: 0 }, { id: 10, x: 50, y: 80 }];
  const perimeter = [
    { id: 11, startNodeId: 1, endNodeId: 9 },
    { id: 12, startNodeId: 9, endNodeId: 2 },
    rectangleWalls[1],
    { id: 13, startNodeId: 3, endNodeId: 10 },
    { id: 14, startNodeId: 10, endNodeId: 4 },
    rectangleWalls[3],
  ];
  const project = createEmptyProject({
    nodes,
    walls: perimeter,
    rooms: [
      { id: 20, name: "Left", nodeIds: [1, 9, 10, 4], wallIds: [11, 15, 14, 8] },
      { id: 21, name: "Right", nodeIds: [9, 2, 3, 10], wallIds: [12, 6, 13, 15] },
    ],
    objects: [{ id: 22, mount: "floor", roomId: 21 }],
  });
  const result = reconcileProjectFaces(project, () => id++);
  assert.equal(result.rooms.length, 1);
  assert.equal(result.objects[0].roomId, result.rooms[0].id);
});
