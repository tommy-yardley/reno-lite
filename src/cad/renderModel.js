import { OBJECT_CATALOG } from "./catalog.js";
import { electricalRoutePoints } from "./electrical.js";
import { openingSpan, polygonArea } from "./geometry.js";
import { PIPE_SYSTEMS, plumbingRoutePoints } from "./plumbing.js";
import { renovationAppearance, visibleInRenovationView } from "./renovation.js";

export const layerForObject = (object) =>
  object.category === "Electrical" || object.category === "Lighting"
    ? "electrical"
    : object.category === "Plumbing"
      ? "plumbing"
      : "furniture";

const isVisible = (project, layer) => project.layerSettings?.[layer]?.visible !== false;

function drawingBounds(project) {
  const points = [...project.nodes];
  for (const object of project.objects) {
    if (object.mount === "wall" || !Number.isFinite(object.x) || !Number.isFinite(object.y)) continue;
    const halfWidth = (object.widthInches || 18) / 2;
    const halfDepth = (object.depthInches || 18) / 2;
    points.push(
      { x: object.x - halfWidth, y: object.y - halfDepth },
      { x: object.x + halfWidth, y: object.y + halfDepth },
    );
  }
  if (!points.length) return { minX: 0, minY: 0, width: 720, height: 480 };
  const minX = Math.min(...points.map((point) => point.x)) - 36;
  const minY = Math.min(...points.map((point) => point.y)) - 36;
  const maxX = Math.max(...points.map((point) => point.x)) + 36;
  const maxY = Math.max(...points.map((point) => point.y)) + 36;
  return {
    minX,
    minY,
    width: Math.max(72, maxX - minX),
    height: Math.max(72, maxY - minY),
  };
}

export function buildRenderModel(project, { respectVisibility = true } = {}) {
  const nodeMap = new Map(project.nodes.map((node) => [node.id, node]));
  const visible = (layer) => !respectVisibility || isVisible(project, layer);
  const renovationView = project.renovationView || "existing";
  const resolvedWalls = project.walls.flatMap((wall) => {
        const start = nodeMap.get(wall.startNodeId);
        const end = nodeMap.get(wall.endNodeId);
        if (!start || !end) return [];
        return [{
          id: wall.id,
          source: wall,
          start,
          end,
          midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
          length: Math.hypot(end.x - start.x, end.y - start.y),
          appearance: renovationAppearance(wall, renovationView),
        }];
      });
  const phaseWalls = resolvedWalls.filter(({ source }) =>
    visibleInRenovationView(source, renovationView),
  );
  const walls = visible("architecture") ? phaseWalls : [];
  const wallMap = new Map(phaseWalls.map((wall) => [wall.id, wall]));
  const rooms = visible("architecture")
    ? project.rooms.flatMap((room) => {
        const points = room.nodeIds.map((id) => nodeMap.get(id)).filter(Boolean);
        if (points.length < 3) return [];
        const grossArea = polygonArea(points);
        const excludedArea =
          room.classification === "void"
            ? 0
            : project.rooms
                .filter(
                  (candidate) =>
                    candidate.classification === "void" && candidate.hostRoomId === room.id,
                )
                .reduce(
                  (sum, candidate) =>
                    sum +
                    polygonArea(candidate.nodeIds.map((id) => nodeMap.get(id)).filter(Boolean)),
                  0,
                );
        return [{
          id: room.id,
          source: room,
          points,
          center: {
            x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
            y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
          },
          grossArea,
          excludedArea,
          area: room.classification === "void" ? grossArea : Math.max(0, grossArea - excludedArea),
        }];
      })
    : [];
  const openings = visible("architecture")
    ? project.openings.filter((opening) => visibleInRenovationView(opening, renovationView)).flatMap((opening) => {
        const wall = wallMap.get(opening.wallId);
        if (!wall) return [];
        return [{
          id: opening.id,
          source: opening,
          wall,
          span: openingSpan(wall.start, wall.end, opening.t, opening.widthInches),
          appearance: renovationAppearance(opening, renovationView),
        }];
      })
    : [];
  const objects = project.objects.flatMap((object) => {
    const layer = layerForObject(object);
    if (!visible(layer) || !visibleInRenovationView(object, renovationView, "proposed")) return [];
    let x = object.x;
    let y = object.y;
    let rotation = object.rotation || 0;
    if (object.mount === "wall") {
      const wall = wallMap.get(object.wallId);
      if (!wall) return [];
      x = wall.start.x + (wall.end.x - wall.start.x) * object.t;
      y = wall.start.y + (wall.end.y - wall.start.y) * object.t;
      rotation = (Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x) * 180) / Math.PI;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    return [{ id: object.id, source: object, layer, preset: OBJECT_CATALOG[object.kind] || {}, x, y, rotation, appearance: renovationAppearance(object, renovationView, "proposed") }];
  });
  const electricalRoutes = visible("electrical")
    ? (project.electricalRoutes || []).filter((route) => visibleInRenovationView(route, renovationView, "proposed")).flatMap((route) => {
        const points = electricalRoutePoints(route, project.objects, project.walls, nodeMap);
        if (points.length < 2) return [];
        return [{
          id: route.id,
          source: route,
          points,
          circuit: (project.electricalCircuits || []).find((item) => item.id === route.circuitId),
          appearance: renovationAppearance(route, renovationView, "proposed"),
        }];
      })
    : [];
  const plumbingRoutes = visible("plumbing")
    ? (project.plumbingRoutes || []).filter((route) => visibleInRenovationView(route, renovationView, "proposed")).flatMap((route) => {
        const points = plumbingRoutePoints(route, project.objects, project.walls, nodeMap);
        if (points.length < 2) return [];
        return [{ id: route.id, source: route, points, system: PIPE_SYSTEMS[route.system] || PIPE_SYSTEMS.cold, appearance: renovationAppearance(route, renovationView, "proposed") }];
      })
    : [];

  return {
    bounds: drawingBounds(project),
    nodeMap,
    rooms,
    walls,
    wallMap,
    openings,
    objects,
    electricalRoutes,
    plumbingRoutes,
  };
}
