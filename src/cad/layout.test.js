import test from "node:test";
import assert from "node:assert/strict";
import { alignObjects, arrangementCandidates, distributeObjects } from "./layout.js";

test("alignment and distribution preserve locked furniture", () => {
  const objects = [{ id: 1, mount: "floor", x: 0, y: 0, widthInches: 10, depthInches: 10 }, { id: 2, mount: "floor", x: 20, y: 10, widthInches: 10, depthInches: 10, layoutLocked: true }, { id: 3, mount: "floor", x: 50, y: 20, widthInches: 10, depthInches: 10 }];
  assert.equal(alignObjects(objects, [1, 2, 3], "top")[1].y, 10);
  assert.equal(distributeObjects(objects, [1, 2, 3], "horizontal")[1].x, 20);
});

test("alignment uses rotated furniture footprints", () => {
  const objects = [{ id: 1, mount: "floor", x: 20, y: 20, widthInches: 20, depthInches: 10, rotation: 0 }, { id: 2, mount: "floor", x: 60, y: 50, widthInches: 20, depthInches: 10, rotation: 90 }];
  const aligned = alignObjects(objects, [1, 2], "left");
  assert.equal(aligned[0].x - 10, aligned[1].x - 5);
});

test("distribution creates equal edge gaps for mixed furniture sizes", () => {
  const objects = [{ id: 1, mount: "floor", x: 10, y: 0, widthInches: 20, depthInches: 10 }, { id: 2, mount: "floor", x: 50, y: 0, widthInches: 10, depthInches: 10 }, { id: 3, mount: "floor", x: 100, y: 0, widthInches: 40, depthInches: 10 }];
  const distributed = distributeObjects(objects, [1, 2, 3], "horizontal");
  const firstGap = distributed[1].x - distributed[1].widthInches / 2 - (distributed[0].x + distributed[0].widthInches / 2);
  const secondGap = distributed[2].x - distributed[2].widthInches / 2 - (distributed[1].x + distributed[1].widthInches / 2);
  assert.ok(Math.abs(firstGap - secondGap) < 0.0001);
});

test("auto arrange produces three scored room layouts", () => {
  const nodes = [{ id: 1, x: 0, y: 0 }, { id: 2, x: 200, y: 0 }, { id: 3, x: 200, y: 200 }, { id: 4, x: 0, y: 200 }];
  const room = { id: 5, nodeIds: [1, 2, 3, 4] };
  const objects = [{ id: 6, roomId: 5, mount: "floor", name: "Chair", x: 50, y: 50, widthInches: 30, depthInches: 30 }];
  assert.equal(arrangementCandidates({ room, rooms: [room], nodes, walls: [], openings: [], objects }).length, 3);
});
