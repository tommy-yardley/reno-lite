import { validateDesignLayout } from "./geometry.js";

function objectBounds(object) {
  const radians = ((object.rotation || 0) * Math.PI) / 180;
  const width = Math.abs(object.widthInches * Math.cos(radians)) + Math.abs(object.depthInches * Math.sin(radians));
  const depth = Math.abs(object.widthInches * Math.sin(radians)) + Math.abs(object.depthInches * Math.cos(radians));
  return { left: object.x - width / 2, right: object.x + width / 2, top: object.y - depth / 2, bottom: object.y + depth / 2, width, depth };
}

export function alignObjects(objects, selectedIds, mode) {
  const selected = objects.filter((object) => selectedIds.includes(object.id) && object.mount === "floor");
  if (selected.length < 2) return objects;
  const bounds = selected.map(objectBounds);
  const left = Math.min(...bounds.map((item) => item.left));
  const right = Math.max(...bounds.map((item) => item.right));
  const top = Math.min(...bounds.map((item) => item.top));
  const bottom = Math.max(...bounds.map((item) => item.bottom));
  const selectedSet = new Set(selectedIds);
  return objects.map((object) => {
    if (!selectedSet.has(object.id) || object.mount !== "floor" || object.layoutLocked) return object;
    const extent = objectBounds(object);
    if (mode === "left") return { ...object, x: left + extent.width / 2 };
    if (mode === "right") return { ...object, x: right - extent.width / 2 };
    if (mode === "top") return { ...object, y: top + extent.depth / 2 };
    if (mode === "bottom") return { ...object, y: bottom - extent.depth / 2 };
    if (mode === "centre") return { ...object, x: (left + right) / 2 };
    if (mode === "middle") return { ...object, y: (top + bottom) / 2 };
    return object;
  });
}

export function distributeObjects(objects, selectedIds, axis) {
  const selected = objects.filter((object) => selectedIds.includes(object.id) && object.mount === "floor").sort((a, b) => axis === "horizontal" ? a.x - b.x : a.y - b.y);
  if (selected.length < 3) return objects;
  const extents = selected.map(objectBounds);
  const size = (bounds) => axis === "horizontal" ? bounds.width : bounds.depth;
  const leading = axis === "horizontal" ? extents[0].left : extents[0].top;
  const trailing = axis === "horizontal" ? extents.at(-1).right : extents.at(-1).bottom;
  const gap = (trailing - leading - extents.reduce((sum, bounds) => sum + size(bounds), 0)) / (selected.length - 1);
  let cursor = leading;
  const positions = new Map(selected.map((object, index) => {
    const objectSize = size(extents[index]);
    const position = cursor + objectSize / 2;
    cursor += objectSize + gap;
    return [object.id, position];
  }));
  return objects.map((object) => positions.has(object.id) && !object.layoutLocked ? { ...object, [axis === "horizontal" ? "x" : "y"]: positions.get(object.id) } : object);
}

function roomBounds(room, nodeMap) {
  const points = room.nodeIds.map((id) => nodeMap.get(id)).filter(Boolean);
  return { minX: Math.min(...points.map((point) => point.x)), maxX: Math.max(...points.map((point) => point.x)), minY: Math.min(...points.map((point) => point.y)), maxY: Math.max(...points.map((point) => point.y)) };
}

function arrangeVariant(items, bounds, variant) {
  const margin = 300 / 25.4;
  const gap = 450 / 25.4;
  const horizontal = variant !== 1;
  const ordered = variant === 2 ? [...items].reverse() : items;
  let cursorX = variant === 2 ? bounds.maxX - margin : bounds.minX + margin;
  let cursorY = variant === 1 ? bounds.maxY - margin : bounds.minY + margin;
  let lineExtent = 0;
  return ordered.map((object) => {
    if (object.layoutLocked) return { id: object.id, x: object.x, y: object.y };
    let x;
    let y;
    if (horizontal) {
      const movingLeft = variant === 2;
      if ((!movingLeft && cursorX + object.widthInches > bounds.maxX - margin) || (movingLeft && cursorX - object.widthInches < bounds.minX + margin)) { cursorX = movingLeft ? bounds.maxX - margin : bounds.minX + margin; cursorY += lineExtent + gap; lineExtent = 0; }
      x = movingLeft ? cursorX - object.widthInches / 2 : cursorX + object.widthInches / 2;
      y = cursorY + object.depthInches / 2;
      cursorX += (movingLeft ? -1 : 1) * (object.widthInches + gap);
      lineExtent = Math.max(lineExtent, object.depthInches);
    } else {
      if (cursorY - object.depthInches < bounds.minY + margin) { cursorY = bounds.maxY - margin; cursorX += lineExtent + gap; lineExtent = 0; }
      x = cursorX + object.widthInches / 2;
      y = cursorY - object.depthInches / 2;
      cursorY -= object.depthInches + gap;
      lineExtent = Math.max(lineExtent, object.widthInches);
    }
    return { id: object.id, x, y };
  });
}

export function arrangementCandidates({ room, rooms, nodes, walls, openings, objects }) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const items = objects.filter((object) => object.mount === "floor" && object.roomId === room.id);
  if (!items.length) return [];
  const bounds = roomBounds(room, nodeMap);
  return [0, 1, 2].map((variant) => {
    const updates = arrangeVariant(items, bounds, variant);
    const updateMap = new Map(updates.map((update) => [update.id, update]));
    const candidateObjects = objects.map((object) => updateMap.has(object.id) ? { ...object, ...updateMap.get(object.id) } : object);
    const validation = validateDesignLayout({ nodes, walls, rooms, openings, objects: candidateObjects });
    return { variant, name: ["Rows", "Columns", "Reverse rows"][variant], updates, warningCount: validation.warnings.length };
  }).sort((left, right) => left.warningCount - right.warningCount);
}
