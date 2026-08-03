// Pure geometry helpers. Nothing in this file touches React state — everything
// takes plain points/numbers in and returns plain points/numbers out, which makes
// it the easiest part of the app to unit-test in isolation.

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function centroidOf(points) {
  const n = points.length || 1;
  return { x: points.reduce((s, p) => s + p.x, 0) / n, y: points.reduce((s, p) => s + p.y, 0) / n };
}

export function shoelaceAreaPx(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(sum) / 2;
}

export function signedShoelaceAreaPx(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

function cross2d(a, b) {
  return a.x * b.y - a.y * b.x;
}

export function segmentIntersection(a, b, c, d, epsilon = 1e-7) {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denominator = cross2d(r, s);
  if (Math.abs(denominator) <= epsilon) return null;

  const delta = { x: c.x - a.x, y: c.y - a.y };
  const t = cross2d(delta, s) / denominator;
  const u = cross2d(delta, r) / denominator;
  if (t < -epsilon || t > 1 + epsilon || u < -epsilon || u > 1 + epsilon) return null;

  return {
    point: { x: a.x + r.x * t, y: a.y + r.y * t },
    t: Math.max(0, Math.min(1, t)),
    u: Math.max(0, Math.min(1, u)),
  };
}

function infiniteLineIntersection(a, directionA, b, directionB, epsilon = 1e-7) {
  const denominator = cross2d(directionA, directionB);
  if (Math.abs(denominator) <= epsilon) return null;
  const delta = { x: b.x - a.x, y: b.y - a.y };
  const t = cross2d(delta, directionB) / denominator;
  return { x: a.x + directionA.x * t, y: a.y + directionA.y * t };
}

// Moves each edge inward by its supplied distance, then intersects adjacent
// offset lines. This measures the usable floor area inside wall centre-lines,
// including the corner/miter area that a perimeter-only estimate misses.
export function insetPolygon(points, edgeInsets) {
  if (points.length < 3) return points;
  const orientation = signedShoelaceAreaPx(points) >= 0 ? 1 : -1;
  const lines = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    const direction = { x: next.x - point.x, y: next.y - point.y };
    const length = Math.hypot(direction.x, direction.y) || 1;
    const inward = orientation > 0
      ? { x: -direction.y / length, y: direction.x / length }
      : { x: direction.y / length, y: -direction.x / length };
    const distance = Math.max(0, edgeInsets[index] || 0);
    return {
      point: { x: point.x + inward.x * distance, y: point.y + inward.y * distance },
      direction,
    };
  });

  const inset = points.map((point, index) => {
    const previous = lines[(index - 1 + lines.length) % lines.length];
    const current = lines[index];
    const intersection = infiniteLineIntersection(previous.point, previous.direction, current.point, current.direction);
    if (intersection && Number.isFinite(intersection.x) && Number.isFinite(intersection.y)) return intersection;
    return {
      x: (previous.point.x + current.point.x) / 2,
      y: (previous.point.y + current.point.y) / 2,
    };
  });

  const originalArea = shoelaceAreaPx(points);
  const insetArea = shoelaceAreaPx(inset);
  if (!Number.isFinite(insetArea) || insetArea > originalArea * 1.01) return points;
  return inset;
}

export function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = (yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function projectOntoSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + dx * t, y: a.y + dy * t };
  return { t, d: dist(p, proj), proj };
}

export function wallSpan(a, b, t, widthInches, scale) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const wallLenPx = Math.hypot(dx, dy) || 1;
  const dir = { x: dx / wallLenPx, y: dy / wallLenPx };
  const widthPx = widthInches / scale;
  const centerT = t * wallLenPx;
  const center = { x: a.x + dir.x * centerT, y: a.y + dir.y * centerT };
  const start = { x: center.x - (dir.x * widthPx) / 2, y: center.y - (dir.y * widthPx) / 2 };
  const end = { x: center.x + (dir.x * widthPx) / 2, y: center.y + (dir.y * widthPx) / 2 };
  return { dir, widthPx, wallLenPx, center, start, end };
}

export function doorGeometry(a, b, t, widthInches, hinge, swingSide, scale) {
  const span = wallSpan(a, b, t, widthInches, scale);
  const perpBase = { x: -span.dir.y, y: span.dir.x };
  const perp = { x: perpBase.x * swingSide, y: perpBase.y * swingSide };
  const H = hinge === "start" ? span.start : span.end;
  const O = hinge === "start" ? span.end : span.start;
  const leafOpenEnd = { x: H.x + perp.x * span.widthPx, y: H.y + perp.y * span.widthPx };
  const cross = (O.x - H.x) * (leafOpenEnd.y - H.y) - (O.y - H.y) * (leafOpenEnd.x - H.x);
  const sweepFlag = cross > 0 ? 1 : 0;
  return { ...span, H, O, leafOpenEnd, sweepFlag };
}

export function polygonBBox(poly) {
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

// Samples points inside polyA's bounding-box intersection with polyB and checks
// how many land inside both — used instead of a pure edge-intersection test
// because two rooms sharing a wall (a legitimate, common case) have coincident
// edges that a naive segment-intersection check would misreport as "overlapping".
export function polygonsAreaOverlap(polyA, polyB, samples = 10) {
  if (polyA.length < 3 || polyB.length < 3) return false;
  const bA = polygonBBox(polyA), bB = polygonBBox(polyB);
  const minX = Math.max(bA.minX, bB.minX), maxX = Math.min(bA.maxX, bB.maxX);
  const minY = Math.max(bA.minY, bB.minY), maxY = Math.min(bA.maxY, bB.maxY);
  if (maxX <= minX || maxY <= minY) return false;
  let hits = 0;
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < samples; j++) {
      const px = minX + ((maxX - minX) * (i + 0.5)) / samples;
      const py = minY + ((maxY - minY) * (j + 0.5)) / samples;
      if (pointInPolygon({ x: px, y: py }, polyA) && pointInPolygon({ x: px, y: py }, polyB)) {
        hits++;
        if (hits >= 3) return true;
      }
    }
  }
  return false;
}

// What fraction of innerPoly's area (by sampling) also falls inside outerPoly.
// Used for "is this void/furniture actually inside the room it's assigned to".
export function polygonContainmentFraction(innerPoly, outerPoly, samples = 10) {
  const b = polygonBBox(innerPoly);
  let insideInner = 0;
  let insideBoth = 0;
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < samples; j++) {
      const px = b.minX + ((b.maxX - b.minX) * (i + 0.5)) / samples;
      const py = b.minY + ((b.maxY - b.minY) * (j + 0.5)) / samples;
      if (pointInPolygon({ x: px, y: py }, innerPoly)) {
        insideInner++;
        if (pointInPolygon({ x: px, y: py }, outerPoly)) insideBoth++;
      }
    }
  }
  return insideInner > 0 ? insideBoth / insideInner : 0;
}

export function deriveWallKeySet(loops) {
  const keys = new Set();
  loops.forEach((loop) => {
    const n = loop.vertexIds.length;
    for (let i = 0; i < n; i++) {
      const aId = loop.vertexIds[i];
      const bId = loop.vertexIds[(i + 1) % n];
      keys.add(aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`);
    }
  });
  return keys;
}

export function reclampOpening(item, wallLenInches, minWidth) {
  let widthInches = item.widthInches;
  if (!wallLenInches || wallLenInches <= 0) return item;
  if (widthInches > wallLenInches * 0.92) {
    widthInches = Math.max(minWidth, wallLenInches * 0.85);
  }
  const minT = widthInches / 2 / wallLenInches;
  const t = Math.max(minT, Math.min(1 - minT, item.t));
  return { ...item, widthInches, t };
}

export function computeRoomWalls(room, vertexMap) {
  const n = room.vertexIds.length;
  const walls = [];
  for (let i = 0; i < n; i++) {
    const aId = room.vertexIds[i];
    const bId = room.vertexIds[(i + 1) % n];
    const a = vertexMap.get(aId);
    const b = vertexMap.get(bId);
    if (!a || !b) continue;
    const key = aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`;
    walls.push({ key, a, b });
  }
  return walls;
}

export function roomContainingPoint(pt, rooms, vertexMap) {
  for (const room of rooms) {
    const pts = room.vertexIds.map((id) => vertexMap.get(id)).filter(Boolean);
    if (pts.length >= 3 && pointInPolygon(pt, pts)) return room;
  }
  return null;
}

export function wallRectCorners(a, b, thicknessPx) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const perp = { x: -dy / len, y: dx / len };
  const half = thicknessPx / 2;
  return [
    { x: a.x + perp.x * half, y: a.y + perp.y * half },
    { x: b.x + perp.x * half, y: b.y + perp.y * half },
    { x: b.x - perp.x * half, y: b.y - perp.y * half },
    { x: a.x - perp.x * half, y: a.y - perp.y * half },
  ];
}

export function furnitureRectPx(item, scale) {
  const wIn = item.rotation % 180 === 90 ? item.depth : item.width;
  const hIn = item.rotation % 180 === 90 ? item.width : item.depth;
  const wPx = wIn / scale;
  const hPx = hIn / scale;
  return { x: item.x - wPx / 2, y: item.y - hPx / 2, w: wPx, h: hPx };
}

export function rectCorners(rect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ];
}

export function doorClearanceQuad(door, wall, scale, roomCentroid, clearanceInches = 30) {
  const span = wallSpan(wall.a, wall.b, door.t, door.widthInches, scale);
  const perpBase = { x: -span.dir.y, y: span.dir.x };
  const mid = span.center;
  const toward = { x: roomCentroid.x - mid.x, y: roomCentroid.y - mid.y };
  const inward = perpBase.x * toward.x + perpBase.y * toward.y >= 0 ? perpBase : { x: -perpBase.x, y: -perpBase.y };
  const depthPx = clearanceInches / scale;
  return [
    span.start,
    span.end,
    { x: span.end.x + inward.x * depthPx, y: span.end.y + inward.y * depthPx },
    { x: span.start.x + inward.x * depthPx, y: span.start.y + inward.y * depthPx },
  ];
}

// Free (unblocked) 1D intervals along a wall of length wallLen, given a list of
// blocked [start, end] intervals (e.g. door clearance zones). Shared by door/window
// placement and the furniture auto-placement engine.
export function freeSegments(wallLen, blocked) {
  const sorted = [...blocked].sort((a, b) => a[0] - b[0]);
  let segs = [[0, wallLen]];
  sorted.forEach(([bStart, bEnd]) => {
    segs = segs.flatMap(([s, e]) => {
      if (bEnd <= s || bStart >= e) return [[s, e]];
      const out = [];
      if (bStart > s) out.push([s, bStart]);
      if (bEnd < e) out.push([bEnd, e]);
      return out;
    });
  });
  return segs.filter(([s, e]) => e - s > 0.01);
}
