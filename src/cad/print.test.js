import test from "node:test";
import assert from "node:assert/strict";
import { computePrintPlan } from "../lib/pdfExport.js";

test("true-scale print planning tiles an oversized plan with labelled overlap", () => {
  const plan = computePrintPlan({ realWidthIn: 600, realHeightIn: 400, paperWIn: 11.69, paperHIn: 16.54, scaleRatio: 50 });
  assert.equal(plan.cols, 2);
  assert.equal(plan.rows, 1);
  assert.deepEqual(plan.tiles.map((tile) => tile.label), ["A1", "A2"]);
  assert.equal(plan.printedWidthIn, 12);
  assert.equal(plan.overlapIn, 0.5);
});
