import test from "node:test";
import assert from "node:assert/strict";
import { aggregateShopping, buildShoppingCsv, buildShoppingSvg } from "./shopping.js";

test("shopping list aggregates matching placed products", () => {
  const lines = aggregateShopping([{ name: "Chair", category: "Dining", pricePence: 5000 }, { name: "Chair", category: "Dining", pricePence: 5000 }]);
  assert.equal(lines[0].quantity, 2);
  assert.equal(lines[0].lineTotalPence, 10000);
  assert.match(buildShoppingCsv(lines), /100\.00/);
  assert.match(buildShoppingSvg(lines), /£100\.00/);
});
