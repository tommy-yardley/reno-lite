import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { distance, nodeIsConstrained, projectToSegment, snapAngle, wallKey } from "./geometry";

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
  return { version: 2, nodes: [], walls: [], unit: "metric", referenceImage: null };
}

export function useCadState() {
  const initial = useMemo(initialState, []);
  const [nodes, setNodes] = useState(initial.nodes);
  const [walls, setWalls] = useState(initial.walls);
  const [unit, setUnit] = useState(initial.unit);
  const [referenceImage, setReferenceImage] = useState(initial.referenceImage);
  const [tool, setTool] = useState("wall");
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [selectedWallId, setSelectedWallId] = useState(null);
  const [pointer, setPointer] = useState(null);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [angleSnap, setAngleSnap] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const nextId = useRef(
    Math.max(0, ...initial.nodes.map((node) => node.id), ...initial.walls.map((wall) => wall.id)) + 1
  );
  const svgRef = useRef(null);
  const fileInputRef = useRef(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedWall = walls.find((wall) => wall.id === selectedWallId) || null;

  const snapshot = useCallback(() => ({ nodes, walls }), [nodes, walls]);
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
    setSelectedWallId(null);
    setActiveNodeId(null);
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(snapshot());
    setNodes(next.nodes);
    setWalls(next.walls);
    setSelectedWallId(null);
    setActiveNodeId(null);
  };

  useEffect(() => {
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 2, nodes, walls, unit, referenceImage })
        );
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [nodes, walls, unit, referenceImage]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setActiveNodeId(null);
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

  const addWallPoint = (rawPoint) => {
    const resolved = resolveDrawPoint(rawPoint);
    let nextNodes = [...nodes];
    let nextWalls = [...walls];
    let targetNode = resolved.node;

    pushHistory();
    if (!targetNode && resolved.wallHit) {
      const { wall, projection } = resolved.wallHit;
      if (projection.t < 0.001) targetNode = nodeMap.get(wall.startNodeId);
      else if (projection.t > 0.999) targetNode = nodeMap.get(wall.endNodeId);
      else {
        targetNode = { id: nextId.current++, ...projection.point };
        nextNodes.push(targetNode);
        nextWalls = nextWalls.filter((item) => item.id !== wall.id);
        nextWalls.push(
          { ...wall, id: nextId.current++, endNodeId: targetNode.id },
          { ...wall, id: nextId.current++, startNodeId: targetNode.id }
        );
      }
    }
    if (!targetNode) {
      targetNode = { id: nextId.current++, ...resolved.point };
      nextNodes.push(targetNode);
    }

    if (activeNodeId != null && activeNodeId !== targetNode.id) {
      const key = wallKey(activeNodeId, targetNode.id);
      const duplicate = nextWalls.some((wall) => wallKey(wall.startNodeId, wall.endNodeId) === key);
      if (!duplicate) {
        nextWalls.push({
          id: nextId.current++,
          startNodeId: activeNodeId,
          endNodeId: targetNode.id,
          thicknessInches: DEFAULT_WALL_THICKNESS_IN,
          locked: false,
        });
      }
    }

    setNodes(nextNodes);
    setWalls(nextWalls);
    setActiveNodeId(targetNode.id);
  };

  const onCanvasPointerDown = (event) => {
    if (event.button !== 0) return;
    const point = clientToWorld(event.clientX, event.clientY);
    if (tool === "wall") addWallPoint(point);
    else setSelectedWallId(null);
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
    setSelectedWallId(wallId);
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
    setSelectedWallId(null);
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
    nodeMap,
    unit,
    setUnit,
    tool,
    setTool,
    activeNodeId,
    setActiveNodeId,
    selectedWall,
    selectedWallId,
    setSelectedWallId,
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
    toggleWallLock,
    setWallLength,
    setWallThickness,
    deleteSelectedWall,
    isNodeLocked: (nodeId) => nodeIsConstrained(nodeId, walls),
    saveStatus,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
