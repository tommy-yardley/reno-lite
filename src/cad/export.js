import { openingSpan, polygonArea } from "./geometry.js";
import { OBJECT_CATALOG } from "./catalog.js";

const xmlEscape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);

function boundsFor(project) {
  const points = [...project.nodes, ...project.objects.filter((object) => object.mount !== "wall")];
  if (!points.length) return { minX: 0, minY: 0, width: 720, height: 480 };
  const minX = Math.min(...points.map((point) => point.x)) - 36;
  const minY = Math.min(...points.map((point) => point.y)) - 36;
  const maxX = Math.max(...points.map((point) => point.x)) + 36;
  const maxY = Math.max(...points.map((point) => point.y)) + 36;
  return { minX, minY, width: Math.max(72, maxX - minX), height: Math.max(72, maxY - minY) };
}

const layerVisible = (project, layer) => project.layerSettings?.[layer]?.visible !== false;

export function buildCadSvg(project) {
  const nodeMap = new Map(project.nodes.map((node) => [node.id, node]));
  const bounds = boundsFor(project);
  const areaByRoom = new Map(project.rooms.map((room) => {
    const gross = polygonArea(room.nodeIds.map((id) => nodeMap.get(id)).filter(Boolean));
    const excluded = project.rooms.filter((candidate) => candidate.classification === "void" && candidate.hostRoomId === room.id).reduce((sum, candidate) => sum + polygonArea(candidate.nodeIds.map((id) => nodeMap.get(id)).filter(Boolean)), 0);
    return [room.id, room.classification === "void" ? gross : Math.max(0, gross - excluded)];
  }));
  const roomMarkup = !layerVisible(project, "architecture") ? "" : project.rooms.map((room) => {
    const points = room.nodeIds.map((id) => nodeMap.get(id)).filter(Boolean);
    if (points.length < 3) return "";
    const center = { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
    const area = areaByRoom.get(room.id) || 0;
    return `<g><polygon points="${points.map((point) => `${point.x},${point.y}`).join(" ")}" fill="${room.classification === "void" ? "#a8a8a2" : room.color || "#dcebdc"}" fill-opacity="${room.classification === "void" ? "0.5" : "0.28"}" ${room.classification === "void" ? 'stroke="#777" stroke-dasharray="5 3"' : ""}/><text x="${center.x}" y="${center.y}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#1b2b3a">${xmlEscape(room.classification === "void" ? `${room.name} · VOID` : room.name)}</text><text x="${center.x}" y="${center.y + 12}" text-anchor="middle" font-family="monospace" font-size="7" fill="#5b6b78">${(area / (39.3700787 ** 2)).toFixed(1)} m²</text></g>`;
  }).join("");
  const wallMarkup = !layerVisible(project, "architecture") ? "" : project.walls.map((wall) => {
    const start = nodeMap.get(wall.startNodeId);
    const end = nodeMap.get(wall.endNodeId);
    return start && end ? `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#17242f" stroke-width="${wall.thicknessInches}" stroke-linecap="square"/>` : "";
  }).join("");
  const openingMarkup = !layerVisible(project, "architecture") ? "" : project.openings.map((opening) => {
    const wall = project.walls.find((item) => item.id === opening.wallId);
    const start = wall && nodeMap.get(wall.startNodeId);
    const end = wall && nodeMap.get(wall.endNodeId);
    if (!start || !end) return "";
    const span = openingSpan(start, end, opening.t, opening.widthInches);
    const color = opening.type === "door" ? "#b8863e" : "#5e86a8";
    return `<line x1="${span.start.x}" y1="${span.start.y}" x2="${span.end.x}" y2="${span.end.y}" stroke="#fff" stroke-width="${Math.max(8, wall.thicknessInches + 3)}"/><line x1="${span.start.x}" y1="${span.start.y}" x2="${span.end.x}" y2="${span.end.y}" stroke="${color}" stroke-width="2"/>`;
  }).join("");
  const objectMarkup = project.objects.map((object) => {
    const preset = OBJECT_CATALOG[object.kind] || {};
    const layer = object.category === "Electrical" || object.category === "Lighting" ? "electrical" : object.category === "Plumbing" ? "plumbing" : "furniture";
    if (!layerVisible(project, layer)) return "";
    if (object.mount === "wall") {
      const wall = project.walls.find((item) => item.id === object.wallId);
      const start = wall && nodeMap.get(wall.startNodeId);
      const end = wall && nodeMap.get(wall.endNodeId);
      if (!start || !end) return "";
      const x = start.x + (end.x - start.x) * object.t;
      const y = start.y + (end.y - start.y) * object.t;
      return `<g transform="translate(${x} ${y})"><rect x="-8" y="-7" width="16" height="14" rx="2" fill="#fff" stroke="#d26a3d"/><text x="0" y="2" text-anchor="middle" font-family="monospace" font-size="5">${xmlEscape(preset.symbol)}</text></g>`;
    }
    if (object.mount === "floor") return `<g transform="translate(${object.x} ${object.y}) rotate(${object.rotation})"><rect x="${-object.widthInches / 2}" y="${-object.depthInches / 2}" width="${object.widthInches}" height="${object.depthInches}" rx="2" fill="#d7c7a7" stroke="#7a6f5c"/><text x="0" y="2" text-anchor="middle" font-family="sans-serif" font-size="7">${xmlEscape(object.name)}</text></g>`;
    return `<g transform="translate(${object.x} ${object.y})"><circle r="9" fill="#fff" stroke="#d4a72c"/><path d="M-6 0H6M0-6V6" stroke="#d4a72c"/><text x="0" y="2" text-anchor="middle" font-family="monospace" font-size="5">${xmlEscape(preset.symbol)}</text></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}" width="${bounds.width}" height="${bounds.height}"><rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="#fff"/>${roomMarkup}${wallMarkup}${openingMarkup}${objectMarkup}</svg>`;
}

const dxfPair = (code, value) => `${code}\n${value}\n`;

export function buildCadDxf(project) {
  const nodeMap = new Map(project.nodes.map((node) => [node.id, node]));
  let output = dxfPair(0, "SECTION") + dxfPair(2, "HEADER") + dxfPair(9, "$INSUNITS") + dxfPair(70, 1) + dxfPair(0, "ENDSEC") + dxfPair(0, "SECTION") + dxfPair(2, "ENTITIES");
  if (layerVisible(project, "architecture")) project.rooms.forEach((room) => {
    const points = room.nodeIds.map((id) => nodeMap.get(id)).filter(Boolean);
    if (points.length < 3) return;
    output += dxfPair(0, "LWPOLYLINE") + dxfPair(8, room.classification === "void" ? "VOIDS" : "ROOMS") + dxfPair(90, points.length) + dxfPair(70, 1);
    points.forEach((point) => { output += dxfPair(10, point.x) + dxfPair(20, -point.y); });
  });
  if (layerVisible(project, "architecture")) project.walls.forEach((wall) => {
    const start = nodeMap.get(wall.startNodeId);
    const end = nodeMap.get(wall.endNodeId);
    if (!start || !end) return;
    output += dxfPair(0, "LINE") + dxfPair(8, wall.locked ? "WALLS_LOCKED" : "WALLS") + dxfPair(10, start.x) + dxfPair(20, -start.y) + dxfPair(11, end.x) + dxfPair(21, -end.y);
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    output += dxfPair(0, "TEXT") + dxfPair(8, "DIMENSIONS") + dxfPair(10, (start.x + end.x) / 2) + dxfPair(20, -(start.y + end.y) / 2) + dxfPair(40, 5) + dxfPair(1, `${length.toFixed(2)} in`);
  });
  if (layerVisible(project, "architecture")) project.openings.forEach((opening) => {
    const wall = project.walls.find((item) => item.id === opening.wallId);
    const start = wall && nodeMap.get(wall.startNodeId);
    const end = wall && nodeMap.get(wall.endNodeId);
    if (!start || !end) return;
    const span = openingSpan(start, end, opening.t, opening.widthInches);
    output += dxfPair(0, "LINE") + dxfPair(8, opening.type === "door" ? "DOORS" : "WINDOWS") + dxfPair(10, span.start.x) + dxfPair(20, -span.start.y) + dxfPair(11, span.end.x) + dxfPair(21, -span.end.y);
  });
  project.objects.forEach((object) => {
    const objectLayer = object.category === "Electrical" || object.category === "Lighting" ? "electrical" : object.category === "Plumbing" ? "plumbing" : "furniture";
    if (!layerVisible(project, objectLayer)) return;
    let x = object.x;
    let y = object.y;
    if (object.mount === "wall") {
      const wall = project.walls.find((item) => item.id === object.wallId);
      const start = wall && nodeMap.get(wall.startNodeId);
      const end = wall && nodeMap.get(wall.endNodeId);
      if (!start || !end) return;
      x = start.x + (end.x - start.x) * object.t;
      y = start.y + (end.y - start.y) * object.t;
    }
    output += dxfPair(0, "TEXT") + dxfPair(8, object.category.toUpperCase()) + dxfPair(10, x) + dxfPair(20, -y) + dxfPair(40, 6) + dxfPair(1, object.name);
  });
  return output + dxfPair(0, "ENDSEC") + dxfPair(0, "EOF");
}

export function serializeProject(project) {
  return JSON.stringify({ format: "reno-lite", version: 3, ...project }, null, 2);
}

export function parseProject(text) {
  const project = JSON.parse(text);
  if (project.format !== "reno-lite" || !Array.isArray(project.nodes) || !Array.isArray(project.walls)) throw new Error("Not a RenoLite project file");
  return {
    nodes: project.nodes,
    walls: project.walls,
    rooms: project.rooms || [],
    openings: project.openings || [],
    objects: project.objects || [],
    unit: project.unit || "metric",
    referenceImage: project.referenceImage || null,
    ...(project.layerSettings ? { layerSettings: project.layerSettings } : {}),
  };
}
