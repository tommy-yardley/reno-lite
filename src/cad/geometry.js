export const ANGLE_SNAP_DEGREES = 15;

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function snapAngle(anchor, point, stepDegrees = ANGLE_SNAP_DEGREES) {
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  const length = Math.hypot(dx, dy);
  if (!length) return { ...point };
  const step = (stepDegrees * Math.PI) / 180;
  const angle = Math.atan2(dy, dx);
  const snappedAngle = Math.round(angle / step) * step;
  return {
    x: anchor.x + Math.cos(snappedAngle) * length,
    y: anchor.y + Math.sin(snappedAngle) * length,
  };
}

export function projectToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
    : 0;
  const projected = { x: start.x + dx * t, y: start.y + dy * t };
  return { point: projected, t, distance: distance(point, projected) };
}

export function wallKey(startNodeId, endNodeId) {
  return startNodeId < endNodeId
    ? `${startNodeId}-${endNodeId}`
    : `${endNodeId}-${startNodeId}`;
}

export function nodeIsConstrained(nodeId, walls, ignoredWallId = null) {
  return walls.some(
    (wall) =>
      wall.id !== ignoredWallId &&
      wall.locked &&
      (wall.startNodeId === nodeId || wall.endNodeId === nodeId)
  );
}

export function polygonArea(points) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

export function pointAlongWall(start, end, t) {
  return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
}

export function openingSpan(start, end, t, widthInches) {
  const wallLength = distance(start, end) || 1;
  const direction = { x: (end.x - start.x) / wallLength, y: (end.y - start.y) / wallLength };
  const center = pointAlongWall(start, end, t);
  const halfWidth = Math.min(widthInches, wallLength * 0.9) / 2;
  return {
    center,
    direction,
    start: { x: center.x - direction.x * halfWidth, y: center.y - direction.y * halfWidth },
    end: { x: center.x + direction.x * halfWidth, y: center.y + direction.y * halfWidth },
    width: halfWidth * 2,
  };
}

export function validateCadGraph({ nodes, walls, rooms = [], openings = [], objects = [] }) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const wallIds = new Set(walls.map((wall) => wall.id));
  const warnings = [];
  const keys = new Set();
  walls.forEach((wall) => {
    if (!nodeIds.has(wall.startNodeId) || !nodeIds.has(wall.endNodeId)) warnings.push(`Wall ${wall.id} has a missing anchor`);
    const key = wallKey(wall.startNodeId, wall.endNodeId);
    if (keys.has(key)) warnings.push(`Wall ${wall.id} duplicates an existing wall`);
    keys.add(key);
  });
  rooms.forEach((room) => {
    if (room.nodeIds.some((id) => !nodeIds.has(id)) || room.wallIds.some((id) => !wallIds.has(id))) warnings.push(`${room.name} has an incomplete boundary`);
  });
  openings.forEach((opening) => {
    if (!wallIds.has(opening.wallId)) warnings.push(`${opening.type} ${opening.id} has no host wall`);
  });
  objects.filter((object) => object.mount === "wall").forEach((object) => {
    if (!wallIds.has(object.wallId)) warnings.push(`${object.name} has no host wall`);
  });
  return warnings;
}
