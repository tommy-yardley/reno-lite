import { dist, centroidOf, computeRoomWalls, freeSegments } from "./geometry";
import { SILL_HEIGHT_IN } from "../constants";

export const CATEGORY_COLORS = {
  Bed: "#B8863E",
  Seating: "#6FA98C",
  Table: "#B58657",
  Storage: "#9C7A52",
  Desk: "#5E86A8",
  Other: "#A98CC9",
};
export const CATEGORIES = Object.keys(CATEGORY_COLORS);
export { SILL_HEIGHT_IN };

// Realistic default width/depth/height (inches) per preset. Height feeds the
// avoid-windows suggestion (see useFloorplanState's addFurniture).
export const FURNITURE_PRESETS = {
  Bedroom: [
    { name: "Queen Bed", category: "Bed", width: 60, depth: 80, height: 40, isAnchor: true },
    { name: "Nightstand", category: "Storage", width: 20, depth: 16, height: 24 },
    { name: "Dresser", category: "Storage", width: 48, depth: 18, height: 32 },
    { name: "Wardrobe", category: "Storage", width: 48, depth: 24, height: 72 },
    { name: "Desk", category: "Desk", width: 48, depth: 24, height: 30 },
  ],
  "Living Room": [
    { name: "Sofa", category: "Seating", width: 84, depth: 36, height: 34, isAnchor: true },
    { name: "TV Console", category: "Storage", width: 60, depth: 16, height: 22 },
    { name: "Coffee Table", category: "Table", width: 48, depth: 24, height: 18, centerpiece: true },
    { name: "Armchair", category: "Seating", width: 30, depth: 30, height: 32 },
    { name: "Side Table", category: "Table", width: 18, depth: 18, height: 22 },
  ],
  Kitchen: [
    { name: "Dining Table", category: "Table", width: 60, depth: 36, height: 30, isAnchor: true },
    { name: "Kitchen Island", category: "Table", width: 60, depth: 30, height: 36, centerpiece: true },
  ],
  Bathroom: [{ name: "Vanity", category: "Storage", width: 36, depth: 20, height: 32, isAnchor: true }],
  Office: [
    { name: "Desk", category: "Desk", width: 60, depth: 30, height: 30, isAnchor: true },
    { name: "Office Chair", category: "Seating", width: 24, depth: 24, height: 38 },
    { name: "Bookshelf", category: "Storage", width: 36, depth: 12, height: 72 },
    { name: "Filing Cabinet", category: "Storage", width: 18, depth: 18, height: 28 },
  ],
  Hallway: [],
  Other: [{ name: "Custom item", category: "Other", width: 24, depth: 24, height: null }],
};

// Rule-based furniture layout for one room: anchors the primary piece (bed/sofa/
// desk/etc) to its longest available wall, fills remaining walls largest-piece-
// first, keeps clear of door swing zones, and skips window spans for any item
// with avoidWindows set. Works on arbitrary polygon edges, not just axis-aligned
// rectangles, since it operates on the room's actual traced wall list.
export function autoPlaceFurniture(room, vertexMap, doors, windows, scale, items) {
  const roomWalls = computeRoomWalls(room, vertexMap);
  const roomPts = room.vertexIds.map((id) => vertexMap.get(id)).filter(Boolean);
  const centroid = centroidOf(roomPts);
  const placed = [];
  const blockedByWall = {};

  roomWalls.forEach((w) => {
    const lenInches = dist(w.a, w.b) * scale;
    const wallDoors = doors.filter((d) => d.wallKey === w.key);
    const blocked = wallDoors.map((d) => {
      const centerInches = d.t * lenInches;
      const halfW = d.widthInches / 2 + 24;
      return [Math.max(0, centerInches - halfW), Math.min(lenInches, centerInches + halfW)];
    });
    blockedByWall[w.key] = { lenInches, blocked, windows: windows.filter((wd) => wd.wallKey === w.key) };
  });

  function tryPlaceOnWall(w, alongWallInches, depthInches, avoidWindows) {
    const info = blockedByWall[w.key];
    let blocked = [...info.blocked];
    if (avoidWindows) {
      info.windows.forEach((win) => {
        const centerInches = win.t * info.lenInches;
        const halfW = win.widthInches / 2;
        blocked.push([Math.max(0, centerInches - halfW), Math.min(info.lenInches, centerInches + halfW)]);
      });
    }
    const segs = freeSegments(info.lenInches, blocked).filter(([s, e]) => e - s >= alongWallInches);
    if (!segs.length) return null;
    segs.sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
    const [s, e] = segs[0];
    const segLen = e - s;
    const offsetInches = s + (segLen - alongWallInches) / 2;
    const wallLenPx = dist(w.a, w.b) || 1;
    const dir = { x: (w.b.x - w.a.x) / wallLenPx, y: (w.b.y - w.a.y) / wallLenPx };
    const perpBase = { x: -dir.y, y: dir.x };
    const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
    const toward = { x: centroid.x - mid.x, y: centroid.y - mid.y };
    const inward = perpBase.x * toward.x + perpBase.y * toward.y >= 0 ? perpBase : { x: -perpBase.x, y: -perpBase.y };
    const offsetPx = offsetInches / scale;
    const alongWallPx = alongWallInches / scale;
    const depthPx = depthInches / scale;
    const startPt = { x: w.a.x + dir.x * offsetPx, y: w.a.y + dir.y * offsetPx };
    const centerAlong = { x: startPt.x + (dir.x * alongWallPx) / 2, y: startPt.y + (dir.y * alongWallPx) / 2 };
    const centerPt = { x: centerAlong.x + (inward.x * depthPx) / 2, y: centerAlong.y + (inward.y * depthPx) / 2 };
    blockedByWall[w.key].blocked.push([offsetInches, offsetInches + alongWallInches]);
    const angleDeg = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    const rotation = (((Math.round(angleDeg / 90) * 90) % 360) + 360) % 360;
    return { x: centerPt.x, y: centerPt.y, rotation };
  }

  const anchor = items.find((i) => i.isAnchor);
  const rest = items.filter((i) => !i.isAnchor && !i.centerpiece);
  const centerpieces = items.filter((i) => i.centerpiece);
  const unplacedIds = [];

  if (anchor) {
    const candidateWalls = [...roomWalls].sort((a, b) => dist(b.a, b.b) - dist(a.a, a.b));
    let fit = false;
    for (const w of candidateWalls) {
      const res = tryPlaceOnWall(w, anchor.width, anchor.depth, anchor.avoidWindows);
      if (res) {
        placed.push({ id: anchor.id, ...res });
        fit = true;
        break;
      }
    }
    if (!fit) unplacedIds.push(anchor.id);
  }

  rest
    .sort((a, b) => b.width * b.depth - a.width * a.depth)
    .forEach((item) => {
      const sortedWalls = [...roomWalls].sort((a, b) => dist(b.a, b.b) - dist(a.a, a.b));
      let fit = false;
      for (const w of sortedWalls) {
        const res = tryPlaceOnWall(w, item.width, item.depth, item.avoidWindows);
        if (res) {
          placed.push({ id: item.id, ...res });
          fit = true;
          break;
        }
      }
      if (!fit) unplacedIds.push(item.id);
    });

  centerpieces.forEach((item, i) => {
    placed.push({ id: item.id, x: centroid.x + i * (8 / scale), y: centroid.y, rotation: 0 });
  });

  return { placed, unplacedIds };
}
