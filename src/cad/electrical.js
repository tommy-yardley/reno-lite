export function objectPosition(object, walls, nodeMap) {
  if (object.mount !== "wall") return { x: object.x, y: object.y };
  const wall = walls.find((item) => item.id === object.wallId);
  const start = wall && nodeMap.get(wall.startNodeId);
  const end = wall && nodeMap.get(wall.endNodeId);
  if (!start || !end) return null;
  return { x: start.x + (end.x - start.x) * object.t, y: start.y + (end.y - start.y) * object.t };
}

export function electricalRoutePoints(route, objects, walls, nodeMap) {
  const from = objectPosition(objects.find((object) => object.id === route.fromObjectId) || {}, walls, nodeMap);
  const to = objectPosition(objects.find((object) => object.id === route.toObjectId) || {}, walls, nodeMap);
  if (!from || !to) return [];
  return [from, ...(route.via?.length ? route.via : [{ x: to.x, y: from.y }]), to];
}

export function validateElectrical({ objects, circuits, routes }) {
  const electrical = objects.filter((object) => ["Electrical", "Lighting"].includes(object.category));
  const circuitIds = new Set(circuits.map((circuit) => circuit.id));
  const objectIds = new Set(electrical.map((object) => object.id));
  const warnings = [];
  circuits.forEach((circuit) => {
    if (!Number.isFinite(circuit.ratingAmps) || circuit.ratingAmps <= 0) warnings.push(`${circuit.name} has an invalid circuit rating.`);
  });
  electrical.forEach((object) => {
    if (!object.circuitId || !circuitIds.has(object.circuitId)) warnings.push(`${object.name} is not assigned to an electrical circuit.`);
    if (["lightSwitch", "dimmer"].includes(object.kind) && !(object.controlsObjectIds || []).length) warnings.push(`${object.name} does not control a light.`);
  });
  routes.forEach((route) => {
    if (!objectIds.has(route.fromObjectId) || !objectIds.has(route.toObjectId)) warnings.push(`Wiring route ${route.id} has a missing device.`);
    if (route.circuitId && !circuitIds.has(route.circuitId)) warnings.push(`Wiring route ${route.id} has a missing circuit.`);
  });
  return warnings;
}
export const CIRCUIT_PRESETS = {
  lighting: { name: "Lighting", kind: "lighting", ratingAmps: 6, colour: "#D68910" },
  socketsRing: { name: "Socket ring", kind: "sockets", ratingAmps: 32, colour: "#2E86C1" },
  socketsRadial: { name: "Socket radial", kind: "sockets", ratingAmps: 20, colour: "#148F77" },
  cooker: { name: "Cooker", kind: "cooker", ratingAmps: 32, colour: "#C0392B" },
  alarms: { name: "Alarms", kind: "alarms", ratingAmps: 6, colour: "#8E44AD" },
};
