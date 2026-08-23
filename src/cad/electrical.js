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
  electrical.forEach((object) => {
    if (!object.circuitId || !circuitIds.has(object.circuitId)) warnings.push(`${object.name} is not assigned to an electrical circuit.`);
    if (["lightSwitch", "dimmer"].includes(object.kind) && !(object.controlsObjectIds || []).length) warnings.push(`${object.name} does not control a light.`);
  });
  routes.forEach((route) => {
    if (!objectIds.has(route.fromObjectId) || !objectIds.has(route.toObjectId)) warnings.push(`Wiring route ${route.id} has a missing device.`);
  });
  return warnings;
}
