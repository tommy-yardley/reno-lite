import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { distance, nodeIsConstrained, polygonArea, projectToSegment, segmentIntersection, snapAngle, validateCadGraph, wallKey } from "./geometry";
import { OBJECT_CATALOG } from "./catalog";
import { compressImageForStorage } from "../lib/imageCompression";

export const WORKSPACE = { width: 720, height: 480 };
const STORAGE_KEY = "reno-lite:cad-v2";
const DEFAULT_WALL_THICKNESS_IN = 4.5;

function initialState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (saved?.version === 2) return saved;
  } catch {
    // Start with an empty drawing when storage is unavailable or invalid.
  }
  return { version: 2, nodes: [], walls: [], rooms: [], openings: [], objects: [], unit: "metric", referenceImage: null };
}

export function useCadState() {
  const initial = useMemo(initialState, []);
  const [nodes, setNodes] = useState(initial.nodes);
  const [walls, setWalls] = useState(initial.walls);
  const [rooms, setRooms] = useState(initial.rooms || []);
  const [openings, setOpenings] = useState(initial.openings || []);
  const [objects, setObjects] = useState(initial.objects || []);
  const [unit, setUnit] = useState(initial.unit);
  const [referenceImage, setReferenceImage] = useState(initial.referenceImage);
  const [tool, setTool] = useState("wall");
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [chainNodeIds, setChainNodeIds] = useState([]);
  const [chainWallIds, setChainWallIds] = useState([]);
  const [selectedWallId, setSelectedWallId] = useState(null);
  const [selectedOpeningId, setSelectedOpeningId] = useState(null);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [placementKind, setPlacementKind] = useState(null);
  const [pointer, setPointer] = useState(null);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [draggingObjectId, setDraggingObjectId] = useState(null);
  const [draggingWallId, setDraggingWallId] = useState(null);
  const [angleSnap, setAngleSnap] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const nextId = useRef(
    Math.max(0, ...initial.nodes.map((node) => node.id), ...initial.walls.map((wall) => wall.id), ...(initial.rooms || []).map((room) => room.id), ...(initial.openings || []).map((opening) => opening.id), ...(initial.objects || []).map((object) => object.id)) + 1
  );
  const svgRef = useRef(null);
  const fileInputRef = useRef(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const wallDragRef = useRef(null);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedWall = walls.find((wall) => wall.id === selectedWallId) || null;
  const selectedOpening = openings.find((opening) => opening.id === selectedOpeningId) || null;
  const selectedObject = objects.find((object) => object.id === selectedObjectId) || null;
  const roomAreas = useMemo(
    () => rooms.map((room) => ({ ...room, areaSqInches: polygonArea(room.nodeIds.map((id) => nodeMap.get(id)).filter(Boolean)) })),
    [nodeMap, rooms]
  );
  const drawingWarnings = useMemo(() => validateCadGraph({ nodes, walls, rooms, openings, objects }), [nodes, walls, rooms, openings, objects]);

  const snapshot = useCallback(() => ({ nodes, walls, rooms, openings, objects }), [nodes, walls, rooms, openings, objects]);
  const pushHistory = useCallback(() => {
    undoStack.current.push(snapshot());
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
  }, [snapshot]);

  const undo = () => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(snapshot());
    setNodes(previous.nodes);
    setWalls(previous.walls);
    setRooms(previous.rooms || []);
    setOpenings(previous.openings || []);
    setObjects(previous.objects || []);
    setSelectedWallId(null);
    setActiveNodeId(null);
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(snapshot());
    setNodes(next.nodes);
    setWalls(next.walls);
    setRooms(next.rooms || []);
    setOpenings(next.openings || []);
    setObjects(next.objects || []);
    setSelectedWallId(null);
    setActiveNodeId(null);
  };

  useEffect(() => {
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 2, nodes, walls, rooms, openings, objects, unit, referenceImage })
        );
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [nodes, walls, rooms, openings, objects, unit, referenceImage]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        finishWallChain();
        setDraggingNodeId(null);
        setDraggingObjectId(null);
        setDraggingWallId(null);
        setPlacementKind(null);
        setTool("select");
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      const editingField = ["INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName);
      if (!editingField && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        if (selectedObjectId != null) deleteObject(selectedObjectId);
        else if (selectedOpeningId != null) deleteOpening(selectedOpeningId);
        else if (selectedWallId != null) deleteSelectedWall();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const clientToWorld = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const matrix = svg.getScreenCTM?.();
    if (matrix) {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const local = point.matrixTransform(matrix.inverse());
      return { x: local.x, y: local.y };
    }
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * WORKSPACE.width,
      y: ((clientY - rect.top) / rect.height) * WORKSPACE.height,
    };
  }, []);

  const hitTolerance = useCallback(() => {
    const matrix = svgRef.current?.getScreenCTM?.();
    return matrix ? 12 / (Math.hypot(matrix.a, matrix.b) || 1) : 10;
  }, []);

  const nearestNode = useCallback(
    (point) => {
      const tolerance = hitTolerance();
      return nodes.reduce((best, node) => {
        const d = distance(point, node);
        return d <= tolerance && (!best || d < best.distance) ? { node, distance: d } : best;
      }, null)?.node;
    },
    [hitTolerance, nodes]
  );

  const nearestWall = useCallback(
    (point) => {
      const tolerance = hitTolerance();
      return walls.reduce((best, wall) => {
        const start = nodeMap.get(wall.startNodeId);
        const end = nodeMap.get(wall.endNodeId);
        if (!start || !end) return best;
        const projection = projectToSegment(point, start, end);
        return projection.distance <= tolerance && (!best || projection.distance < best.projection.distance)
          ? { wall, projection }
          : best;
      }, null);
    },
    [hitTolerance, nodeMap, walls]
  );

  const resolveDrawPoint = useCallback(
    (rawPoint) => {
      const anchor = activeNodeId == null ? null : nodeMap.get(activeNodeId);
      let point = anchor && angleSnap ? snapAngle(anchor, rawPoint) : rawPoint;
      const node = nearestNode(point);
      if (node) return { point: node, node };
      const wallHit = nearestWall(point);
      if (wallHit) return { point: wallHit.projection.point, wallHit };
      return { point };
    },
    [activeNodeId, angleSnap, nearestNode, nearestWall, nodeMap]
  );

  const finishWallChain = () => {
    setActiveNodeId(null);
    setChainNodeIds([]);
    setChainWallIds([]);
  };

  const beginObjectPlacement = (kind) => {
    if (!OBJECT_CATALOG[kind]) return;
    finishWallChain();
    setPlacementKind(kind);
    setTool("object");
    setSelectedObjectId(null);
    setSelectedWallId(null);
    setSelectedOpeningId(null);
  };

  const createObject = (point, wallId = null, t = null) => {
    const preset = OBJECT_CATALOG[placementKind];
    if (!preset) return;
    const object = {
      id: nextId.current++,
      kind: placementKind,
      name: preset.label,
      category: preset.category,
      mount: preset.mount,
      x: point.x,
      y: point.y,
      wallId,
      t,
      widthInches: preset.widthInches || 18,
      depthInches: preset.depthInches || 18,
      rotation: 0,
    };
    pushHistory();
    setObjects((items) => [...items, object]);
    setSelectedObjectId(object.id);
    setPlacementKind(null);
    setTool("select");
  };

  const addWallPoint = (rawPoint) => {
    const resolved = resolveDrawPoint(rawPoint);
    let nextNodes = [...nodes];
    let nextWalls = [...walls];
    let nextRooms = [...rooms];
    let nextOpenings = [...openings];
    let nextObjects = [...objects];
    let targetNode = resolved.node;

    pushHistory();
    const splitWall = (wall, junction, splitT) => {
      const firstWall = { ...wall, id: nextId.current++, endNodeId: junction.id };
      const secondWall = { ...wall, id: nextId.current++, startNodeId: junction.id };
      nextWalls = nextWalls.filter((item) => item.id !== wall.id);
      nextWalls.push(firstWall, secondWall);
      nextRooms = nextRooms.map((room) => {
        if (!room.wallIds.includes(wall.id)) return room;
        const wallIndex = room.wallIds.indexOf(wall.id);
        const wallIds = [...room.wallIds];
        wallIds.splice(wallIndex, 1, firstWall.id, secondWall.id);
        const nodeIds = [...room.nodeIds];
        const startIndex = nodeIds.findIndex((id, index) => {
          const nextNodeId = nodeIds[(index + 1) % nodeIds.length];
          return (id === wall.startNodeId && nextNodeId === wall.endNodeId) || (id === wall.endNodeId && nextNodeId === wall.startNodeId);
        });
        if (startIndex >= 0) nodeIds.splice(startIndex + 1, 0, junction.id);
        return { ...room, wallIds, nodeIds };
      });
      nextOpenings = nextOpenings.map((opening) => {
        if (opening.wallId !== wall.id) return opening;
        if (opening.t <= splitT) return { ...opening, wallId: firstWall.id, t: opening.t / splitT };
        return { ...opening, wallId: secondWall.id, t: (opening.t - splitT) / (1 - splitT) };
      });
      nextObjects = nextObjects.map((object) => {
        if (object.wallId !== wall.id) return object;
        if (object.t <= splitT) return { ...object, wallId: firstWall.id, t: object.t / splitT };
        return { ...object, wallId: secondWall.id, t: (object.t - splitT) / (1 - splitT) };
      });
    };

    if (!targetNode && resolved.wallHit) {
      const { wall, projection } = resolved.wallHit;
      if (projection.t < 0.001) targetNode = nodeMap.get(wall.startNodeId);
      else if (projection.t > 0.999) targetNode = nodeMap.get(wall.endNodeId);
      else {
        targetNode = { id: nextId.current++, ...projection.point };
        nextNodes.push(targetNode);
        splitWall(wall, targetNode, projection.t);
      }
    }
    if (!targetNode) {
      targetNode = { id: nextId.current++, ...resolved.point };
      nextNodes.push(targetNode);
    }

    const junctions = [];
    if (activeNodeId != null && activeNodeId !== targetNode.id) {
      const segmentStart = nextNodes.find((node) => node.id === activeNodeId);
      const candidates = [...nextWalls];
      candidates.forEach((wall) => {
        if ([wall.startNodeId, wall.endNodeId].includes(activeNodeId) || [wall.startNodeId, wall.endNodeId].includes(targetNode.id)) return;
        const wallStart = nextNodes.find((node) => node.id === wall.startNodeId);
        const wallEnd = nextNodes.find((node) => node.id === wall.endNodeId);
        if (!segmentStart || !wallStart || !wallEnd) return;
        const hit = segmentIntersection(segmentStart, targetNode, wallStart, wallEnd);
        if (!hit || hit.t <= 0.001 || hit.t >= 0.999 || hit.u <= 0.001 || hit.u >= 0.999) return;
        let junction = junctions.find((item) => distance(item, hit.point) < 0.01);
        if (!junction) {
          junction = { id: nextId.current++, ...hit.point, segmentT: hit.t };
          junctions.push(junction);
          nextNodes.push({ id: junction.id, x: junction.x, y: junction.y });
        }
        splitWall(wall, junction, hit.u);
      });
    }

    junctions.sort((left, right) => left.segmentT - right.segmentT);
    const segmentNodeIds = activeNodeId == null ? [] : [activeNodeId, ...junctions.map((junction) => junction.id), targetNode.id];
    const addedWallIds = [];
    for (let index = 0; index < segmentNodeIds.length - 1; index += 1) {
      const startNodeId = segmentNodeIds[index];
      const endNodeId = segmentNodeIds[index + 1];
      const key = wallKey(startNodeId, endNodeId);
      const duplicate = nextWalls.find((wall) => wallKey(wall.startNodeId, wall.endNodeId) === key);
      if (duplicate) addedWallIds.push(duplicate.id);
      else {
        const wallId = nextId.current++;
        nextWalls.push({ id: wallId, startNodeId, endNodeId, thicknessInches: DEFAULT_WALL_THICKNESS_IN, locked: false });
        addedWallIds.push(wallId);
      }
    }

    const closingRoom =
      chainNodeIds.length >= 3 &&
      targetNode.id === chainNodeIds[0] &&
      activeNodeId !== targetNode.id;
    if (closingRoom) {
      nextRooms.push({ id: nextId.current++, name: `Room ${nextRooms.length + 1}`, type: "Room", nodeIds: [...chainNodeIds, ...junctions.map((junction) => junction.id)], wallIds: [...chainWallIds, ...addedWallIds], color: "#B9D8C2" });
      finishWallChain();
    } else {
      setActiveNodeId(targetNode.id);
      setChainNodeIds((ids) => (ids.length ? [...ids, ...junctions.map((junction) => junction.id), targetNode.id] : [targetNode.id]));
      if (addedWallIds.length) setChainWallIds((ids) => [...ids, ...addedWallIds]);
    }
    setNodes(nextNodes);
    setWalls(nextWalls);
    setRooms(nextRooms);
    setOpenings(nextOpenings);
    setObjects(nextObjects);
  };

  const addWallAtLength = (inches) => {
    if (activeNodeId == null || !Number.isFinite(inches) || inches <= 0) return;
    const anchor = nodeMap.get(activeNodeId);
    if (!anchor) return;
    const guide = pointer || { x: anchor.x + inches, y: anchor.y };
    const guideLength = distance(anchor, guide) || 1;
    addWallPoint({ x: anchor.x + ((guide.x - anchor.x) / guideLength) * inches, y: anchor.y + ((guide.y - anchor.y) / guideLength) * inches });
  };

  const addOpening = (wallId, rawPoint, type) => {
    const wall = walls.find((item) => item.id === wallId);
    const start = wall && nodeMap.get(wall.startNodeId);
    const end = wall && nodeMap.get(wall.endNodeId);
    if (!wall || !start || !end) return;
    const projection = projectToSegment(rawPoint, start, end);
    pushHistory();
    const opening = {
      id: nextId.current++,
      wallId,
      type,
      t: Math.max(0.08, Math.min(0.92, projection.t)),
      widthInches: type === "door" ? 32 : 36,
      swing: 1,
    };
    setOpenings((items) => [...items, opening]);
    setSelectedOpeningId(opening.id);
    setTool("select");
  };

  const onCanvasPointerDown = (event) => {
    if (event.button !== 0) return;
    const point = clientToWorld(event.clientX, event.clientY);
    if (tool === "wall") addWallPoint(point);
    else if (tool === "object" && OBJECT_CATALOG[placementKind]?.mount !== "wall") createObject(point);
    else {
      setSelectedWallId(null);
      setSelectedOpeningId(null);
      setSelectedObjectId(null);
    }
  };

  const onCanvasPointerMove = (event) => {
    const rawPoint = clientToWorld(event.clientX, event.clientY);
    setPointer(resolveDrawPoint(rawPoint).point);
    const point = {
      x: Math.max(0, Math.min(WORKSPACE.width, rawPoint.x)),
      y: Math.max(0, Math.min(WORKSPACE.height, rawPoint.y)),
    };
    if (draggingNodeId != null) {
      setNodes((items) => items.map((node) => (node.id === draggingNodeId ? { ...node, ...point } : node)));
    }
    if (draggingObjectId != null) {
      setObjects((items) => items.map((object) => (object.id === draggingObjectId ? { ...object, x: point.x, y: point.y } : object)));
    }
    if (draggingWallId != null && wallDragRef.current) {
      const dx = rawPoint.x - wallDragRef.current.pointer.x;
      const dy = rawPoint.y - wallDragRef.current.pointer.y;
      const { start, end } = wallDragRef.current;
      setNodes((items) => items.map((node) => {
        if (node.id === start.id) return { ...node, x: start.x + dx, y: start.y + dy };
        if (node.id === end.id) return { ...node, x: end.x + dx, y: end.y + dy };
        return node;
      }));
    }
  };

  const onNodePointerDown = (nodeId) => (event) => {
    event.stopPropagation();
    if (tool === "wall") {
      addWallPoint(nodeMap.get(nodeId));
      return;
    }
    if (tool !== "select") return;
    if (nodeIsConstrained(nodeId, walls)) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pushHistory();
    setDraggingNodeId(nodeId);
  };

  const onWallPointerDown = (wallId) => (event) => {
    event.stopPropagation();
    if (tool === "wall") {
      addWallPoint(clientToWorld(event.clientX, event.clientY));
      return;
    }
    if (tool === "door" || tool === "window") {
      addOpening(wallId, clientToWorld(event.clientX, event.clientY), tool);
      return;
    }
    if (tool === "object" && OBJECT_CATALOG[placementKind]?.mount === "wall") {
      const wall = walls.find((item) => item.id === wallId);
      const start = wall && nodeMap.get(wall.startNodeId);
      const end = wall && nodeMap.get(wall.endNodeId);
      if (start && end) {
        const point = clientToWorld(event.clientX, event.clientY);
        const projection = projectToSegment(point, start, end);
        createObject(projection.point, wallId, Math.max(0.03, Math.min(0.97, projection.t)));
      }
      return;
    }
    setSelectedWallId(wallId);
    setSelectedOpeningId(null);
    setSelectedObjectId(null);
    const wall = walls.find((item) => item.id === wallId);
    const start = wall && nodeMap.get(wall.startNodeId);
    const end = wall && nodeMap.get(wall.endNodeId);
    const canMove = wall && !wall.locked && start && end && !nodeIsConstrained(start.id, walls, wall.id) && !nodeIsConstrained(end.id, walls, wall.id);
    if (canMove) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pushHistory();
      wallDragRef.current = { pointer: clientToWorld(event.clientX, event.clientY), start: { ...start }, end: { ...end } };
      setDraggingWallId(wallId);
    }
  };

  const onOpeningPointerDown = (openingId) => (event) => {
    event.stopPropagation();
    setSelectedOpeningId(openingId);
    setSelectedWallId(null);
    setTool("select");
  };

  const onObjectPointerDown = (objectId) => (event) => {
    event.stopPropagation();
    const object = objects.find((item) => item.id === objectId);
    setSelectedObjectId(objectId);
    setSelectedWallId(null);
    setSelectedOpeningId(null);
    setTool("select");
    if (object?.mount === "wall") return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pushHistory();
    setDraggingObjectId(objectId);
  };

  const onCanvasPointerUp = () => {
    setDraggingNodeId(null);
    setDraggingObjectId(null);
    setDraggingWallId(null);
    wallDragRef.current = null;
  };

  const toggleWallLock = (wallId) => {
    pushHistory();
    setWalls((items) => items.map((wall) => (wall.id === wallId ? { ...wall, locked: !wall.locked } : wall)));
  };

  const setWallLength = (wallId, inches) => {
    if (!Number.isFinite(inches) || inches <= 0) return;
    const wall = walls.find((item) => item.id === wallId);
    if (!wall || wall.locked) return;
    const start = nodeMap.get(wall.startNodeId);
    const end = nodeMap.get(wall.endNodeId);
    if (!start || !end) return;
    const currentLength = distance(start, end) || 1;
    const direction = { x: (end.x - start.x) / currentLength, y: (end.y - start.y) / currentLength };
    const canMoveEnd = !nodeIsConstrained(end.id, walls, wall.id);
    const canMoveStart = !nodeIsConstrained(start.id, walls, wall.id);
    if (!canMoveEnd && !canMoveStart) return;
    pushHistory();
    setNodes((items) =>
      items.map((node) => {
        if (canMoveEnd && node.id === end.id) {
          return { ...node, x: start.x + direction.x * inches, y: start.y + direction.y * inches };
        }
        if (!canMoveEnd && canMoveStart && node.id === start.id) {
          return { ...node, x: end.x - direction.x * inches, y: end.y - direction.y * inches };
        }
        return node;
      })
    );
  };

  const setWallThickness = (wallId, inches) => {
    if (!Number.isFinite(inches) || inches <= 0) return;
    pushHistory();
    setWalls((items) => items.map((wall) => (wall.id === wallId ? { ...wall, thicknessInches: inches } : wall)));
  };

  const deleteSelectedWall = () => {
    if (!selectedWall) return;
    pushHistory();
    const remainingWalls = walls.filter((wall) => wall.id !== selectedWall.id);
    const used = new Set(remainingWalls.flatMap((wall) => [wall.startNodeId, wall.endNodeId]));
    setWalls(remainingWalls);
    setNodes((items) => items.filter((node) => used.has(node.id)));
    setRooms((items) => items.filter((room) => !room.wallIds.includes(selectedWall.id)));
    setOpenings((items) => items.filter((opening) => opening.wallId !== selectedWall.id));
    setObjects((items) => items.filter((object) => object.wallId !== selectedWall.id));
    setSelectedWallId(null);
  };

  const updateRoom = (roomId, updates) => {
    setRooms((items) => items.map((room) => (room.id === roomId ? { ...room, ...updates } : room)));
  };

  const deleteRoom = (roomId) => {
    pushHistory();
    setRooms((items) => items.filter((room) => room.id !== roomId));
  };

  const updateOpening = (openingId, updates) => {
    if (updates.widthInches != null && (!Number.isFinite(updates.widthInches) || updates.widthInches <= 0)) return;
    pushHistory();
    setOpenings((items) => items.map((opening) => (opening.id === openingId ? { ...opening, ...updates } : opening)));
  };

  const deleteOpening = (openingId) => {
    pushHistory();
    setOpenings((items) => items.filter((opening) => opening.id !== openingId));
    setSelectedOpeningId(null);
  };

  const updateObject = (objectId, updates, recordHistory = true) => {
    if (updates.widthInches != null && (!Number.isFinite(updates.widthInches) || updates.widthInches <= 0)) return;
    if (updates.depthInches != null && (!Number.isFinite(updates.depthInches) || updates.depthInches <= 0)) return;
    if (recordHistory) pushHistory();
    setObjects((items) => items.map((object) => (object.id === objectId ? { ...object, ...updates } : object)));
  };

  const deleteObject = (objectId) => {
    pushHistory();
    setObjects((items) => items.filter((object) => object.id !== objectId));
    setSelectedObjectId(null);
  };

  const loadProject = (project) => {
    pushHistory();
    setNodes(project.nodes || []);
    setWalls(project.walls || []);
    setRooms(project.rooms || []);
    setOpenings(project.openings || []);
    setObjects(project.objects || []);
    setUnit(project.unit || "metric");
    setReferenceImage(project.referenceImage || null);
    const ids = [...(project.nodes || []), ...(project.walls || []), ...(project.rooms || []), ...(project.openings || []), ...(project.objects || [])].map((item) => item.id || 0);
    nextId.current = Math.max(0, ...ids) + 1;
    finishWallChain();
    setSelectedWallId(null);
    setSelectedOpeningId(null);
    setSelectedObjectId(null);
    setPlacementKind(null);
    setTool("select");
  };

  const clearProject = () => {
    pushHistory();
    setNodes([]);
    setWalls([]);
    setRooms([]);
    setOpenings([]);
    setObjects([]);
    setReferenceImage(null);
    nextId.current = 1;
    finishWallChain();
    setSelectedWallId(null);
    setSelectedOpeningId(null);
    setSelectedObjectId(null);
    setPlacementKind(null);
    setTool("wall");
  };

  const handleReferenceUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const image = new Image();
      image.onload = async () => {
        try {
          const compressed = await compressImageForStorage(reader.result, image.naturalWidth, image.naturalHeight, 1800, 0.82);
          setReferenceImage({ src: compressed.src, name: file.name, width: compressed.w, height: compressed.h });
        } catch {
          setReferenceImage({ src: reader.result, name: file.name, width: image.naturalWidth, height: image.naturalHeight });
        }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return {
    svgRef,
    fileInputRef,
    nodes,
    walls,
    rooms,
    roomAreas,
    drawingWarnings,
    openings,
    objects,
    nodeMap,
    unit,
    setUnit,
    tool,
    setTool,
    activeNodeId,
    setActiveNodeId,
    finishWallChain,
    addWallAtLength,
    selectedWall,
    selectedWallId,
    setSelectedWallId,
    selectedOpening,
    selectedOpeningId,
    setSelectedOpeningId,
    selectedObject,
    selectedObjectId,
    setSelectedObjectId,
    placementKind,
    setPlacementKind,
    beginObjectPlacement,
    pointer,
    angleSnap,
    setAngleSnap,
    referenceImage,
    setReferenceImage,
    handleReferenceUpload,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onNodePointerDown,
    onWallPointerDown,
    onOpeningPointerDown,
    onObjectPointerDown,
    toggleWallLock,
    setWallLength,
    setWallThickness,
    deleteSelectedWall,
    updateRoom,
    deleteRoom,
    updateOpening,
    deleteOpening,
    updateObject,
    deleteObject,
    loadProject,
    clearProject,
    isNodeLocked: (nodeId) => nodeIsConstrained(nodeId, walls),
    saveStatus,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
