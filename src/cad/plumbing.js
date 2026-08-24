import { objectPosition } from "./electrical.js";

export const PIPE_SYSTEMS = {
  cold: { label: "Cold water", colour: "#2E86C1", dash: "", diametersMm: [15, 22, 28], defaultDiameterMm: 15 },
  hot: { label: "Hot water", colour: "#C0392B", dash: "", diametersMm: [15, 22, 28], defaultDiameterMm: 15 },
  waste: { label: "Waste", colour: "#5D6D7E", dash: "7 3", diametersMm: [32, 40, 50, 110], defaultDiameterMm: 40 },
  heatingFlow: { label: "Heating flow", colour: "#D68910", dash: "", diametersMm: [10, 15, 22, 28], defaultDiameterMm: 15 },
  heatingReturn: { label: "Heating return", colour: "#8E6E53", dash: "5 2", diametersMm: [10, 15, 22, 28], defaultDiameterMm: 15 },
};

export function plumbingRoutePoints(route, objects, walls, nodeMap) {
  const from = objectPosition(objects.find((object) => object.id === route.fromObjectId) || {}, walls, nodeMap);
  const to = objectPosition(objects.find((object) => object.id === route.toObjectId) || {}, walls, nodeMap);
  if (!from || !to) return [];
  return [from, ...(route.via?.length ? route.via : [{ x: from.x, y: to.y }]), to];
}

export function validatePlumbing({ objects, routes }) {
  const fixtures = objects.filter((object) => object.category === "Plumbing");
  const connected = new Set(routes.flatMap((route) => [route.fromObjectId, route.toObjectId]));
  const objectIds = new Set(fixtures.map((fixture) => fixture.id));
  const warnings = fixtures.filter((fixture) => !connected.has(fixture.id)).map((fixture) => `${fixture.name} has no plumbing route.`);
  routes.forEach((route) => {
    if (!objectIds.has(route.fromObjectId) || !objectIds.has(route.toObjectId)) warnings.push(`Pipe route ${route.id} has a missing fixture.`);
    if (!PIPE_SYSTEMS[route.system]) warnings.push(`Pipe route ${route.id} has an unknown service.`);
    else if (!PIPE_SYSTEMS[route.system].diametersMm.includes(route.diameterMm)) warnings.push(`Pipe route ${route.id} uses a non-standard concept diameter for ${PIPE_SYSTEMS[route.system].label.toLowerCase()}.`);
  });
  return warnings;
}
