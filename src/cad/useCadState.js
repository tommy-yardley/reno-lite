import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { distance, nodeIsConstrained, polygonArea, projectToSegment, snapAngle, wallKey } from "./geometry";

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
  return { version: 2, nodes: [], walls: [], rooms: [], openings: [], unit: "metric", referenceImage: null };
}

export function useCadState() {
  const initial = useMemo(initialState, []);
  const [nodes, setNodes] = useState(initial.nodes);
  const [walls, setWalls] = useState(initial.walls);
  const [rooms, setRooms] = useState(initial.rooms || []);
  const [openings, setOpenings] = useState(initial.openings || []);
  const [unit, setUnit] = useState(initial.unit);
  const [referenceImage, setReferenceImage] = useState(initial.referenceImage);
  const [tool, setTool] = useState("wall");
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [chainNodeIds, setChainNodeIds] = useState([]);
  const [chainWallIds, setChainWallIds] = useState([]);
  const [selectedWallId, setSelectedWallId] = useState(null);
  const [selectedOpeningId, setSelectedOpeningId] = useState(null);
  const [pointer, setPointer] = useState(null);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [angleSnap, setAngleSnap] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const nextId = useRef(
    Math.max(0, ...initial.nodes.map((node) => node.id), ...initial.walls.map((wall) => wall.id), ...(initial.rooms || []).map((room) => room.id), ...(initial.openings || []).map((opening) => opening.id)) + 1
  );
  const svgRef = useRef(null);
  const fileInputRef = useRef(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedWall = walls.find((wall) => wall.id === selectedWallId) || null;
  const selectedOpening = openings.find((opening) => opening.id === selectedOpeningId) || null;
  const roomAreas = useMemo(
    () => rooms.map((room) => ({ ...room, areaSqInches: polygonArea(room.nodeIds.map((id) => nodeMap.get(id)).filter(Boolean)) })),
    [nodeMap, rooms]
  );

  const snapshot = useCallback(() => ({ nodes, walls, rooms, openings }), [nodes, walls, rooms, openings]);
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
    setSelectedWallId(null);
    setActiveNodeId(null);
  };

  useEffect(() => {
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 2, nodes, walls, rooms, openings, unit, referenceImage })
        );
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [nodes, walls, rooms, openings, unit, referenceImage]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        finishWallChain();
        setDraggingNodeId(null);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
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

  const addWallPoint = (rawPoint) => {
    const resolved = resolveDrawPoint(rawPoint);
    let nextNodes = [...nodes];
    let nextWalls = [...walls];
    let nextRooms = [...rooms];
    let nextOpenings = [...openings];
    let targetNode = resolved.node;

    pushHistory();
    if (!targetNode && resolved.wallHit) {
      const { wall, projection } = resolved.wallHit;
      if (projection.t < 0.001) targetNode = nodeMap.get(wall.startNodeId);
      else if (projection.t > 0.999) targetNode = nodeMap.get(wall.endNodeId);
      else {
        targetNode = { id: nextId.current++, ...projection.point };
        nextNodes.push(targetNode);
        const firstWall = { ...wall, id: nextId.current++, endNodeId: targetNode.id };
        const secondWall = { ...wall, id: nextId.current++, startNodeId: targetNode.id };
        nextWalls = nextWalls.filter((item) => item.id !== wall.id);
        nextWalls.push(firstWall, secondWall);
        nextRooms = nextRooms.map((room) => {
          if (!room.wallIds.includes(wall.id)) return room;
          const wallIndex = room.wallIds.indexOf(wall.id);
          const wallIds = [...room.wallIds];
          wallIds.splice(wallIndex, 1, firstWall.id, secondWall.id);
          const nodeIds = [...room.nodeIds];
          const startIndex = nodeIds.findIndex((id, index) => {
            const nextIdInRoom = nodeIds[(index + 1) % nodeIds.length];
            return (id === wall.startNodeId && nextIdInRoom === wall.endNodeId) || (id === wall.endNodeId && nextIdInRoom === wall.startNodeId);
          });
          if (startIndex >= 0) nodeIds.splice(startIndex + 1, 0, targetNode.id);
          return { ...room, wallIds, nodeIds };
        });
        nextOpenings = nextOpenings.map((opening) => {
          if (opening.wallId !== wall.id) return opening;
          if (opening.t <= projection.t) return { ...opening, wallId: firstWall.id, t: opening.t / projection.t };
          return { ...opening, wallId: secondWall.id, t: (opening.t - projection.t) / (1 - projection.t) };
        });
      }
    }
    if (!targetNode) {
      targetNode = { id: nextId.current++, ...resolved.point };
      nextNodes.push(targetNode);
    }

    let addedWallId = null;
    if (activeNodeId != null && activeNodeId !== targetNode.id) {
      const key = wallKey(activeNodeId, targetNode.id);
      const duplicate = nextWalls.find((wall) => wallKey(wall.startNodeId, wall.endNodeId) === key);
      if (duplicate) addedWallId = duplicate.id;
      else {
        addedWallId = nextId.current++;
        nextWalls.push({
          id: addedWallId,
          startNodeId: activeNodeId,
          endNodeId: targetNode.id,
          thicknessInches: DEFAULT_WALL_THICKNESS_IN,
          locked: false,
        });
      }
    }

    setNodes(nextNodes);
    setWalls(nextWalls);
    setRooms(nextRooms);
    setOpenings(nextOpenings);

    const closingRoom =
      chainNodeIds.length >= 3 &&
      targetNode.id === chainNodeIds[0] &&
      activeNodeId !== targetNode.id;
    if (closingRoom) {
      setRooms((items) => [
        ...items,
        {
          id: nextId.current++,
          name: `Room ${items.length + 1}`,
          type: "Room",
          nodeIds: chainNodeIds,
          wallIds: [...chainWallIds, addedWallId].filter(Boolean),
          color: "#B9D8C2",
        },
      ]);
      finishWallChain();
    } else {
      setActiveNodeId(targetNode.id);
      setChainNodeIds((ids) => (ids.length ? [...ids, targetNode.id] : [targetNode.id]));
      if (addedWallId) setChainWallIds((ids) => [...ids, addedWallId]);
    }
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
    else {
      setSelectedWallId(null);
      setSelectedOpeningId(null);
    }
  };

  const onCanvasPointerMove = (event) => {
    const rawPoint = clientToWorld(event.clientX, event.clientY);
    setPointer(resolveDrawPoint(rawPoint).point);
    if (draggingNodeId == null) return;
    const point = {
      x: Math.max(0, Math.min(WORKSPACE.width, rawPoint.x)),
      y: Math.max(0, Math.min(WORKSPACE.height, rawPoint.y)),
    };
    setNodes((items) => items.map((node) => (node.id === draggingNodeId ? { ...node, ...point } : node)));
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
    setSelectedWallId(wallId);
    setSelectedOpeningId(null);
  };

  const onOpeningPointerDown = (openingId) => (event) => {
    event.stopPropagation();
    setSelectedOpeningId(openingId);
    setSelectedWallId(null);
    setTool("select");
  };

  const onCanvasPointerUp = () => setDraggingNodeId(null);

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

  const handleReferenceUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => setReferenceImage({ src: reader.result, name: file.name, width: image.naturalWidth, height: image.naturalHeight });
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
    openings,
    nodeMap,
    unit,
    setUnit,
    tool,
    setTool,
    activeNodeId,
    setActiveNodeId,
    finishWallChain,
    selectedWall,
    selectedWallId,
    setSelectedWallId,
    selectedOpening,
    selectedOpeningId,
    setSelectedOpeningId,
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
    toggleWallLock,
    setWallLength,
    setWallThickness,
    deleteSelectedWall,
    updateRoom,
    deleteRoom,
    updateOpening,
    deleteOpening,
    isNodeLocked: (nodeId) => nodeIsConstrained(nodeId, walls),
    saveStatus,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
