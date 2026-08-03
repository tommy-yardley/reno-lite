import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  dist,
  centroidOf,
  shoelaceAreaPx,
  pointInPolygon,
  projectOntoSegment,
  reclampOpening,
  computeRoomWalls,
  roomContainingPoint,
  furnitureRectPx,
  rectCorners,
  doorClearanceQuad,
  polygonsAreaOverlap,
  polygonContainmentFraction,
  deriveWallKeySet,
  segmentIntersection,
  insetPolygon,
} from "../lib/geometry";
import { parseLengthInput } from "../lib/units";
import { buildDxf } from "../lib/dxfExport";
import { buildJpegPdf, renderPrintPdf, PAPER_SIZES, PRINT_SCALES } from "../lib/pdfExport";
import { FURNITURE_PRESETS, autoPlaceFurniture } from "../lib/furnitureEngine";
import { saveOrShareFile } from "../lib/nativeExport";
import { captureFloorPlanPhoto } from "../lib/nativeCamera";
import { useHistory } from "./useHistory";
import { usePersistence } from "./usePersistence";
import { ROOM_TYPES, ROOM_COLORS, DEFAULT_WALL_THICKNESS_IN, DEFAULT_DOOR_WIDTH_IN, DEFAULT_WINDOW_WIDTH_IN, SILL_HEIGHT_IN, INCH_PER_METER } from "../constants";

export function useFloorplanState() {
  /* ---------------- core state ---------------- */

  const [unit, setUnit] = useState("metric");
  const [image, setImage] = useState(null);
  const [scale, setScale] = useState(null);

  const [mode, setMode] = useState("idle");
  const [calPoints, setCalPoints] = useState([]);
  const [calLengthInput, setCalLengthInput] = useState("");
  const [calibrationLine, setCalibrationLine] = useState(null);

  const [vertices, setVertices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [voids, setVoids] = useState([]);
  const [drawKind, setDrawKind] = useState("room");
  const [currentChain, setCurrentChain] = useState([]);
  const [chainNewVertexIds, setChainNewVertexIds] = useState([]);
  const [mousePos, setMousePos] = useState(null);
  const [draggingVertexId, setDraggingVertexId] = useState(null);
  const [pendingRoom, setPendingRoom] = useState(null);
  const [roomNameInput, setRoomNameInput] = useState("");
  const [roomTypeInput, setRoomTypeInput] = useState(ROOM_TYPES[0]);

  const [doors, setDoors] = useState([]);
  const [windows, setWindows] = useState([]);
  const [selectedDoorId, setSelectedDoorId] = useState(null);
  const [selectedWindowId, setSelectedWindowId] = useState(null);
  const [draggingDoorId, setDraggingDoorId] = useState(null);
  const [draggingWindowId, setDraggingWindowId] = useState(null);

  const [wallProps, setWallProps] = useState({});
  const [furniture, setFurniture] = useState([]);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState(null);
  const [draggingFurnitureId, setDraggingFurnitureId] = useState(null);
  const [addFurnitureRoomId, setAddFurnitureRoomId] = useState(null);
  const [autoArrangeWarning, setAutoArrangeWarning] = useState(null);

  const [selectedWallKey, setSelectedWallKey] = useState(null);
  const [wallLengthInput, setWallLengthInput] = useState("");
  const [extBatchInput, setExtBatchInput] = useState("");
  const [intBatchInput, setIntBatchInput] = useState("");
  const [selectedVertexId, setSelectedVertexId] = useState(null);

  const [angleSnap, setAngleSnap] = useState(true);
  const [imperialFraction, setImperialFraction] = useState(true);
  const [northAngle, setNorthAngle] = useState(0);
  const [showInteriorArea, setShowInteriorArea] = useState(true);

  const [exporting, setExporting] = useState(null);
  const [printSettings, setPrintSettings] = useState({ paperKey: "letter", scaleKey: null });

  const svgRef = useRef(null);
  const nextId = useRef(1);
  const fileInputRef = useRef(null);
  const dragStartRef = useRef(null);

  /* ---------------- derived: vertex map + walls ---------------- */

  const vertexMap = useMemo(() => {
    const m = new Map();
    vertices.forEach((v) => m.set(v.id, v));
    return m;
  }, [vertices]);

  const wallSegments = useMemo(() => {
    const map = new Map();
    [...rooms, ...voids].forEach((loop) => {
      const n = loop.vertexIds.length;
      for (let i = 0; i < n; i++) {
        const aId = loop.vertexIds[i];
        const bId = loop.vertexIds[(i + 1) % n];
        const key = aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`;
        if (!map.has(key)) {
          const a = vertexMap.get(aId);
          const b = vertexMap.get(bId);
          if (a && b) map.set(key, { key, a, b });
        }
      }
    });
    return [...map.values()];
  }, [rooms, voids, vertexMap]);

  /* ---------------- undo / redo ---------------- */

  const getSnapshot = useCallback(
    () => ({ vertices, rooms, voids, doors, windows, wallProps, furniture }),
    [vertices, rooms, voids, doors, windows, wallProps, furniture]
  );
  const applySnapshot = useCallback((snap) => {
    setVertices(snap.vertices);
    setRooms(snap.rooms);
    setVoids(snap.voids);
    setDoors(snap.doors);
    setWindows(snap.windows);
    setWallProps(snap.wallProps || {});
    setFurniture(snap.furniture || []);
  }, []);
  const { canUndo, canRedo, pushHistory, undo, redo, clearHistory } = useHistory({ getSnapshot, applySnapshot });

  /* ---------------- persistence ---------------- */

  const persistedState = useMemo(
    () => ({
      image, scale, calibrationLine, vertices, rooms, voids, doors, windows, wallProps, furniture,
      unit, imperialFraction, northAngle, showInteriorArea, angleSnap,
    }),
    [image, scale, calibrationLine, vertices, rooms, voids, doors, windows, wallProps, furniture, unit, imperialFraction, northAngle, showInteriorArea, angleSnap]
  );

  const persistenceSetters = useMemo(
    () => ({
      setImage, setScale, setCalibrationLine, setVertices, setRooms, setVoids, setDoors, setWindows,
      setWallProps, setFurniture, setUnit, setImperialFraction, setNorthAngle, setShowInteriorArea, setAngleSnap,
    }),
    []
  );

  const { loadedFromStorage, saveStatus, clearSavedPlan } = usePersistence({
    state: persistedState,
    setters: persistenceSetters,
    nextIdRef: nextId,
  });

  /* ---------------- wall length editing + batch thickness ---------------- */

  const setWallLength = (wallKey, newLengthInches) => {
    const wall = wallSegments.find((w) => w.key === wallKey);
    if (!wall || !newLengthInches || newLengthInches <= 0) return;
    const dx = wall.b.x - wall.a.x;
    const dy = wall.b.y - wall.a.y;
    const curLenPx = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / curLenPx, y: dy / curLenPx };
    const newLenPx = newLengthInches / scale;
    const newX = wall.a.x + dir.x * newLenPx;
    const newY = wall.a.y + dir.y * newLenPx;
    const movedId = wall.b.id;
    setVertices((vs) => vs.map((v) => (v.id === movedId ? { ...v, x: newX, y: newY } : v)));

    const touched = wallSegments.filter((w) => w.a.id === movedId || w.b.id === movedId);
    const lenByKey = new Map();
    touched.forEach((w) => {
      const aPt = w.a.id === movedId ? { x: newX, y: newY } : w.a;
      const bPt = w.b.id === movedId ? { x: newX, y: newY } : w.b;
      lenByKey.set(w.key, dist(aPt, bPt) * scale);
    });
    setDoors((ds) => ds.map((d) => (lenByKey.has(d.wallKey) ? reclampOpening(d, lenByKey.get(d.wallKey), 12) : d)));
    setWindows((ws) => ws.map((w) => (lenByKey.has(w.wallKey) ? reclampOpening(w, lenByKey.get(w.wallKey), 6) : w)));
  };

  const selectedWall = selectedWallKey ? wallSegments.find((w) => w.key === selectedWallKey) : null;

  const getWallProps = useCallback((wallKey) => wallProps[wallKey] || { thickness: DEFAULT_WALL_THICKNESS_IN, open: false }, [wallProps]);

  const setWallThickness = (wallKey, thicknessInches) => {
    setWallProps((wp) => ({ ...wp, [wallKey]: { ...getWallProps(wallKey), thickness: Math.max(1, thicknessInches) } }));
  };
  const toggleWallOpen = (wallKey) => {
    pushHistory();
    setWallProps((wp) => ({ ...wp, [wallKey]: { ...getWallProps(wallKey), open: !getWallProps(wallKey).open } }));
  };

  const wallLoopCounts = useMemo(() => {
    const counts = {};
    [...rooms, ...voids].forEach((loop) => {
      const n = loop.vertexIds.length;
      for (let i = 0; i < n; i++) {
        const aId = loop.vertexIds[i];
        const bId = loop.vertexIds[(i + 1) % n];
        const key = aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [rooms, voids]);

  const setBatchWallThickness = (predicate, thicknessInches) => {
    if (!thicknessInches || thicknessInches <= 0) return;
    pushHistory();
    setWallProps((wp) => {
      const next = { ...wp };
      wallSegments.forEach((w) => {
        if (!predicate(w)) return;
        const existing = next[w.key] || { thickness: DEFAULT_WALL_THICKNESS_IN, open: false };
        if (existing.open) return;
        next[w.key] = { ...existing, thickness: thicknessInches };
      });
      return next;
    });
  };
  const applyExteriorThickness = (inches) => setBatchWallThickness((w) => (wallLoopCounts[w.key] || 0) <= 1, inches);
  const applyInteriorThickness = (inches) => setBatchWallThickness((w) => (wallLoopCounts[w.key] || 0) >= 2, inches);

  /* ---------------- corner (vertex) deletion ---------------- */

  const selectedVertexAffectedLoops = useMemo(() => {
    if (selectedVertexId == null) return [];
    return [...rooms, ...voids].filter((loop) => loop.vertexIds.includes(selectedVertexId));
  }, [selectedVertexId, rooms, voids]);
  const canDeleteSelectedVertex = selectedVertexId != null && selectedVertexAffectedLoops.every((loop) => loop.vertexIds.length > 3);

  const deleteVertexEverywhere = (vid) => {
    const newRooms = rooms.map((r) => (r.vertexIds.includes(vid) ? { ...r, vertexIds: r.vertexIds.filter((id) => id !== vid) } : r));
    const newVoids = voids.map((v) => (v.vertexIds.includes(vid) ? { ...v, vertexIds: v.vertexIds.filter((id) => id !== vid) } : v));
    if ([...newRooms, ...newVoids].some((loop) => loop.vertexIds.length < 3)) return;
    pushHistory();
    const remainingKeys = deriveWallKeySet([...newRooms, ...newVoids]);
    setRooms(newRooms);
    setVoids(newVoids);
    setVertices((vs) => vs.filter((v) => v.id !== vid));
    setDoors((ds) => ds.filter((d) => remainingKeys.has(d.wallKey)));
    setWindows((ws) => ws.filter((w) => remainingKeys.has(w.wallKey)));
    setWallProps((wp) => {
      const next = {};
      Object.keys(wp).forEach((k) => {
        if (remainingKeys.has(k)) next[k] = wp[k];
      });
      return next;
    });
    setSelectedVertexId(null);
  };

  /* ---------------- overlap / escape validation ---------------- */

  const overlappingRoomIds = useMemo(() => {
    const bad = new Set();
    for (let i = 0; i < rooms.length; i++) {
      const ptsI = rooms[i].vertexIds.map((id) => vertexMap.get(id)).filter(Boolean);
      if (ptsI.length < 3) continue;
      for (let j = i + 1; j < rooms.length; j++) {
        const ptsJ = rooms[j].vertexIds.map((id) => vertexMap.get(id)).filter(Boolean);
        if (ptsJ.length < 3) continue;
        if (polygonsAreaOverlap(ptsI, ptsJ)) {
          bad.add(rooms[i].id);
          bad.add(rooms[j].id);
        }
      }
    }
    return bad;
  }, [rooms, vertexMap]);

  const escapedVoidIds = useMemo(() => {
    const bad = new Set();
    voids.forEach((v) => {
      const pts = v.vertexIds.map((id) => vertexMap.get(id)).filter(Boolean);
      if (pts.length < 3) return;
      let best = 0;
      rooms.forEach((room) => {
        const roomPts = room.vertexIds.map((id) => vertexMap.get(id)).filter(Boolean);
        if (roomPts.length < 3) return;
        const frac = polygonContainmentFraction(pts, roomPts);
        if (frac > best) best = frac;
      });
      if (best < 0.9) bad.add(v.id);
    });
    return bad;
  }, [voids, rooms, vertexMap]);

  const furnitureWarnings = useMemo(() => {
    const bad = new Map();
    if (!scale) return bad;
    const byRoom = {};
    furniture.forEach((it) => {
      (byRoom[it.roomId] = byRoom[it.roomId] || []).push(it);
    });
    rooms.forEach((room) => {
      const items = byRoom[room.id] || [];
      if (!items.length) return;
      const roomPts = room.vertexIds.map((id) => vertexMap.get(id)).filter(Boolean);
      if (roomPts.length < 3) return;
      const centroid = centroidOf(roomPts);
      const roomWalls = computeRoomWalls(room, vertexMap);
      const clearanceQuads = [];
      roomWalls.forEach((w) => {
        doors.filter((d) => d.wallKey === w.key).forEach((d) => clearanceQuads.push(doorClearanceQuad(d, w, scale, centroid)));
      });
      const rects = items.map((it) => ({ id: it.id, corners: rectCorners(furnitureRectPx(it, scale)) }));
      rects.forEach((r) => {
        if (polygonContainmentFraction(r.corners, roomPts) < 0.5) bad.set(r.id, "outside");
      });
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          if (polygonsAreaOverlap(rects[i].corners, rects[j].corners)) {
            if (!bad.has(rects[i].id)) bad.set(rects[i].id, "overlap");
            if (!bad.has(rects[j].id)) bad.set(rects[j].id, "overlap");
          }
        }
        clearanceQuads.forEach((quad) => {
          if (polygonsAreaOverlap(rects[i].corners, quad) && !bad.has(rects[i].id)) bad.set(rects[i].id, "overlap");
        });
      }
    });
    return bad;
  }, [furniture, rooms, doors, vertexMap, scale]);

  /* ---------------- image upload / camera ---------------- */

  const loadImageFromDataUrl = (src) => {
    const img = new Image();
    img.onload = () => {
      setImage({ src, w: img.naturalWidth, h: img.naturalHeight });
      setScale(null);
      setCalibrationLine(null);
      setVertices([]);
      setRooms([]);
      setVoids([]);
      setDoors([]);
      setWindows([]);
      setWallProps({});
      setFurniture([]);
      setCurrentChain([]);
      setMode("idle");
      clearHistory();
      setSelectedWallKey(null);
      setSelectedVertexId(null);
    };
    img.src = src;
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadImageFromDataUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = async () => {
    const dataUrl = await captureFloorPlanPhoto();
    if (dataUrl) loadImageFromDataUrl(dataUrl);
  };

  /* ---------------- coordinate conversion ---------------- */

  const clientToImageCoords = useCallback(
    (clientX, clientY) => {
      const svg = svgRef.current;
      if (!svg || !image) return { x: 0, y: 0 };
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
        x: ((clientX - rect.left) / Math.max(1, rect.width)) * image.w,
        y: ((clientY - rect.top) / Math.max(1, rect.height)) * image.h,
      };
    },
    [image]
  );

  const snapTolerance = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !image) return 18;
    const matrix = svg.getScreenCTM?.();
    if (matrix) {
      const screenScale = Math.hypot(matrix.a, matrix.b) || 1;
      return 18 / screenScale;
    }
    const rect = svg.getBoundingClientRect();
    return 18 * (image.w / Math.max(1, rect.width));
  }, [image]);

  const findNearbyVertex = useCallback(
    (pt) => {
      const tol = snapTolerance();
      let best = null;
      let bestD = tol;
      vertices.forEach((v) => {
        const d = dist(v, pt);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      });
      return best;
    },
    [vertices, snapTolerance]
  );

  const findNearbyWallPoint = useCallback(
    (pt) => {
      const tolerance = snapTolerance();
      let best = null;
      wallSegments.forEach((wall) => {
        const projected = projectOntoSegment(pt, wall.a, wall.b);
        if (projected.d <= tolerance && (!best || projected.d < best.d)) {
          best = { wall, point: projected.proj, t: projected.t, d: projected.d };
        }
      });
      return best;
    },
    [wallSegments, snapTolerance]
  );

  const wallKeyFor = (aId, bId) => (aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`);

  const insertVertexIntoLoop = (loop, aId, bId, vertexId) => {
    if (loop.vertexIds.includes(vertexId)) return loop;
    const ids = loop.vertexIds;
    for (let index = 0; index < ids.length; index++) {
      const nextIndex = (index + 1) % ids.length;
      const matches =
        (ids[index] === aId && ids[nextIndex] === bId) ||
        (ids[index] === bId && ids[nextIndex] === aId);
      if (!matches) continue;
      const nextIds = [...ids];
      nextIds.splice(index + 1, 0, vertexId);
      return { ...loop, vertexIds: nextIds };
    }
    return loop;
  };

  const splitWallAtPoint = (wall, point, beforeSplit, preferredVertex = null) => {
    const endpointTolerance = Math.max(0.5, snapTolerance() * 0.2);
    if (dist(point, wall.a) <= endpointTolerance) return wall.a.id;
    if (dist(point, wall.b) <= endpointTolerance) return wall.b.id;

    beforeSplit();
    const vertex = preferredVertex || { id: nextId.current++, x: point.x, y: point.y };
    if (!preferredVertex) setVertices((items) => [...items, vertex]);

    const firstKey = wallKeyFor(wall.a.id, vertex.id);
    const secondKey = wallKeyFor(vertex.id, wall.b.id);
    const splitT = Math.max(0.0001, Math.min(0.9999, projectOntoSegment(vertex, wall.a, wall.b).t));
    const firstLengthInches = scale ? dist(wall.a, vertex) * scale : null;
    const secondLengthInches = scale ? dist(vertex, wall.b) * scale : null;

    setRooms((items) => items.map((loop) => insertVertexIntoLoop(loop, wall.a.id, wall.b.id, vertex.id)));
    setVoids((items) => items.map((loop) => insertVertexIntoLoop(loop, wall.a.id, wall.b.id, vertex.id)));
    setWallProps((items) => {
      const next = { ...items };
      const existing = next[wall.key];
      delete next[wall.key];
      if (existing) {
        next[firstKey] = { ...existing };
        next[secondKey] = { ...existing };
      }
      return next;
    });

    const remapOpening = (item, minimumWidth) => {
      if (item.wallKey !== wall.key) return item;
      if (item.t <= splitT) {
        const moved = { ...item, wallKey: firstKey, t: item.t / splitT };
        return firstLengthInches ? reclampOpening(moved, firstLengthInches, minimumWidth) : moved;
      }
      const moved = { ...item, wallKey: secondKey, t: (item.t - splitT) / (1 - splitT) };
      return secondLengthInches ? reclampOpening(moved, secondLengthInches, minimumWidth) : moved;
    };

    setDoors((items) => items.map((item) => remapOpening(item, 12)));
    setWindows((items) => items.map((item) => remapOpening(item, 6)));
    setSelectedWallKey((key) => (key === wall.key ? null : key));
    return vertex.id;
  };

  /* ---------------- calibration ---------------- */

  const startCalibration = () => {
    setMode("calibrating");
    setCalPoints([]);
    setCalLengthInput("");
    setSelectedWallKey(null);
    setSelectedVertexId(null);
    setSelectedDoorId(null);
    setSelectedWindowId(null);
  };

  const confirmCalibration = () => {
    const realInches = parseLengthInput(calLengthInput, unit);
    if (!realInches || calPoints.length !== 2) return;
    const pxDist = dist(calPoints[0], calPoints[1]);
    if (pxDist < 1) return;
    setScale(realInches / pxDist);
    setCalibrationLine({ p1: calPoints[0], p2: calPoints[1], inches: realInches });
    setMode("idle");
    setCalPoints([]);
    setCalLengthInput("");
  };

  const cancelCalibration = () => {
    setMode("idle");
    setCalPoints([]);
    setCalLengthInput("");
  };

  /* ---------------- room / void tracing ---------------- */

  const startDrawingRoom = (kind = "room") => {
    setDrawKind(kind);
    setMode("drawing");
    setCurrentChain([]);
    setChainNewVertexIds([]);
    setSelectedWallKey(null);
    setSelectedVertexId(null);
    setSelectedDoorId(null);
    setSelectedWindowId(null);
  };

  const undoLastPoint = () => {
    if (currentChain.length === 0) return;
    const lastId = currentChain[currentChain.length - 1];
    setCurrentChain((c) => c.slice(0, -1));
    if (chainNewVertexIds.includes(lastId)) {
      setVertices((vs) => vs.filter((v) => v.id !== lastId));
      setChainNewVertexIds((ids) => ids.filter((id) => id !== lastId));
    }
  };

  const cancelDrawingRoom = () => {
    setVertices((vs) => vs.filter((v) => !chainNewVertexIds.includes(v.id)));
    setCurrentChain([]);
    setChainNewVertexIds([]);
    setMode("idle");
  };

  const handleSvgClick = (e) => {
    if (!image) return;
    const pt = clientToImageCoords(e.clientX, e.clientY);

    if (mode === "calibrating") {
      if (calPoints.length >= 2) return;
      setCalPoints((p) => [...p, pt]);
      return;
    }

    if (mode === "placingDoor" || mode === "placingWindow") {
      const tol = snapTolerance() * 1.6;
      let best = null;
      wallSegments.forEach((w) => {
        if (getWallProps(w.key).open) return;
        const res = projectOntoSegment(pt, w.a, w.b);
        if (res.d < tol && (!best || res.d < best.d)) best = { ...res, wall: w };
      });
      if (!best) return;
      const wallLenInches = dist(best.wall.a, best.wall.b) * scale;
      const clickInches = best.t * wallLenInches;

      if (mode === "placingDoor") {
        const existing = doors.find(
          (d) => d.wallKey === best.wall.key && Math.abs(d.t * wallLenInches - clickInches) < d.widthInches / 2 + 10
        );
        if (existing) {
          setSelectedDoorId(existing.id);
          setSelectedWindowId(null);
          return;
        }
        pushHistory();
        const widthInches = Math.min(DEFAULT_DOOR_WIDTH_IN, wallLenInches * 0.7);
        const minT = widthInches / 2 / wallLenInches;
        const t = Math.max(minT, Math.min(1 - minT, best.t));
        const id = nextId.current++;
        setDoors((d) => [...d, { id, wallKey: best.wall.key, t, widthInches, hinge: "start", swingSide: 1 }]);
        setSelectedDoorId(id);
      } else {
        const existing = windows.find(
          (w) => w.wallKey === best.wall.key && Math.abs(w.t * wallLenInches - clickInches) < w.widthInches / 2 + 10
        );
        if (existing) {
          setSelectedWindowId(existing.id);
          setSelectedDoorId(null);
          return;
        }
        pushHistory();
        const widthInches = Math.min(DEFAULT_WINDOW_WIDTH_IN, wallLenInches * 0.7);
        const minT = widthInches / 2 / wallLenInches;
        const t = Math.max(minT, Math.min(1 - minT, best.t));
        const id = nextId.current++;
        setWindows((w) => [...w, { id, wallKey: best.wall.key, t, widthInches }]);
        setSelectedWindowId(id);
      }
      return;
    }

    if (mode === "drawing") {
      let splitHistoryCaptured = false;
      const captureSplitHistory = () => {
        if (splitHistoryCaptured) return;
        pushHistory();
        splitHistoryCaptured = true;
      };

      let snappedPt = pt;
      let nearby = findNearbyVertex(pt);
      let wallTarget = nearby ? null : findNearbyWallPoint(pt);

      // Existing geometry wins over angle snapping, so it remains easy to land
      // on a nearby corner or wall. Otherwise every new segment snaps to 45°.
      if (nearby) {
        snappedPt = nearby;
      } else if (wallTarget) {
        snappedPt = wallTarget.point;
      } else if (angleSnap && currentChain.length > 0) {
        const anchor = vertexMap.get(currentChain[currentChain.length - 1]);
        if (anchor) {
          const dx = pt.x - anchor.x;
          const dy = pt.y - anchor.y;
          const d = Math.hypot(dx, dy);
          if (d > 2) {
            const angle = Math.atan2(dy, dx);
            const snapStep = Math.PI / 4;
            const nearestSnap = Math.round(angle / snapStep) * snapStep;
            snappedPt = { x: anchor.x + Math.cos(nearestSnap) * d, y: anchor.y + Math.sin(nearestSnap) * d };
          }
        }
        nearby = findNearbyVertex(snappedPt);
        wallTarget = nearby ? null : findNearbyWallPoint(snappedPt);
        if (nearby) snappedPt = nearby;
        else if (wallTarget) snappedPt = wallTarget.point;
      }

      let targetId;
      if (nearby) {
        targetId = nearby.id;
      } else if (wallTarget) {
        targetId = splitWallAtPoint(wallTarget.wall, wallTarget.point, captureSplitHistory);
      } else {
        targetId = nextId.current++;
        const vertex = { id: targetId, x: snappedPt.x, y: snappedPt.y };
        setVertices((items) => [...items, vertex]);
        setChainNewVertexIds((ids) => [...ids, targetId]);
      }

      // Split every existing wall crossed by the new segment and put the same
      // junction vertices into the new room chain. Rooms then share topology
      // instead of visually crossing one another with unrelated lines.
      const intermediate = [];
      if (currentChain.length > 0) {
        const anchor = vertexMap.get(currentChain[currentChain.length - 1]);
        const endPoint = nearby || wallTarget?.point || snappedPt;
        if (anchor && dist(anchor, endPoint) > 0.5) {
          wallSegments.forEach((wall) => {
            const hit = segmentIntersection(anchor, endPoint, wall.a, wall.b);
            if (!hit || hit.t <= 0.0001 || hit.t >= 0.9999) return;

            const duplicate = intermediate.find((entry) => dist(entry.point, hit.point) <= Math.max(0.5, snapTolerance() * 0.12));
            const preferred = duplicate ? { id: duplicate.id, x: duplicate.point.x, y: duplicate.point.y } : null;
            const vertexId = splitWallAtPoint(wall, hit.point, captureSplitHistory, preferred);
            if (!duplicate) intermediate.push({ id: vertexId, point: hit.point, t: hit.t });
          });
          intermediate.sort((a, b) => a.t - b.t);
        }
      }

      const additions = [];
      intermediate.forEach(({ id }) => {
        if (id !== currentChain[currentChain.length - 1] && additions[additions.length - 1] !== id && id !== targetId) additions.push(id);
      });

      if (targetId === currentChain[0] && currentChain.length + additions.length >= 3) {
        setPendingRoom({ vertexIds: [...currentChain, ...additions], kind: drawKind });
        setRoomNameInput(drawKind === "void" ? `Blocked space ${voids.length + 1}` : `Room ${rooms.length + 1}`);
        setRoomTypeInput(ROOM_TYPES[0]);
        setMode("naming");
        return;
      }

      if (currentChain[currentChain.length - 1] !== targetId) {
        setCurrentChain((chain) => {
          const next = [...chain];
          [...additions, targetId].forEach((id) => {
            if (next[next.length - 1] !== id) next.push(id);
          });
          return next;
        });
      }
    }
  };

  const confirmRoomName = () => {
    if (!pendingRoom) return;
    pushHistory();
    if (pendingRoom.kind === "void") {
      setVoids((v) => [...v, { id: nextId.current++, name: roomNameInput || `Blocked space ${voids.length + 1}`, vertexIds: pendingRoom.vertexIds }]);
    } else {
      const color = ROOM_COLORS[rooms.length % ROOM_COLORS.length];
      setRooms((r) => [
        ...r,
        { id: nextId.current++, name: roomNameInput || `Room ${rooms.length + 1}`, type: roomTypeInput, color, vertexIds: pendingRoom.vertexIds },
      ]);
    }
    setPendingRoom(null);
    setCurrentChain([]);
    setChainNewVertexIds([]);
    setMode("idle");
  };

  const cancelRoomName = () => {
    setPendingRoom(null);
    setMode("drawing");
  };

  const deleteRoom = (id) => {
    pushHistory();
    setRooms((r) => r.filter((rm) => rm.id !== id));
    setFurniture((f) => f.filter((it) => it.roomId !== id));
  };
  const renameRoom = (id, name) => setRooms((r) => r.map((rm) => (rm.id === id ? { ...rm, name } : rm)));
  const retypeRoom = (id, type) => {
    pushHistory();
    setRooms((r) => r.map((rm) => (rm.id === id ? { ...rm, type } : rm)));
  };

  const deleteVoid = (id) => {
    pushHistory();
    setVoids((v) => v.filter((vd) => vd.id !== id));
  };
  const renameVoid = (id, name) => setVoids((v) => v.map((vd) => (vd.id === id ? { ...vd, name } : vd)));

  /* ---------------- doors & windows ---------------- */

  const togglePlacingDoor = () => {
    if (mode === "placingDoor") {
      setMode("idle");
      return;
    }
    setSelectedWallKey(null);
    setSelectedVertexId(null);
    setMode("placingDoor");
  };
  const togglePlacingWindow = () => {
    if (mode === "placingWindow") {
      setMode("idle");
      return;
    }
    setSelectedWallKey(null);
    setSelectedVertexId(null);
    setMode("placingWindow");
  };

  // The listener below is registered once (empty deps) so it's never torn down and
  // re-added — but that means its closure would otherwise go stale: mode stays
  // "drawing" for the whole tracing session while chainNewVertexIds keeps growing
  // with every corner clicked, so a naive `[mode]` dependency would make Escape
  // cancel using whatever (likely empty) vertex list existed when drawing *started*,
  // silently leaving orphaned points behind. Routing through a ref updated on every
  // render keeps it reading current state without needing to resubscribe.
  const escapeStateRef = useRef();
  escapeStateRef.current = { mode, cancelDrawingRoom, cancelCalibration, setMode, setSelectedWallKey, setSelectedVertexId, setSelectedDoorId, setSelectedWindowId, setSelectedFurnitureId };

  useEffect(() => {
    const onEscape = (e) => {
      if (e.key !== "Escape") return;
      const s = escapeStateRef.current;
      if (s.mode === "drawing") s.cancelDrawingRoom();
      else if (s.mode === "calibrating") s.cancelCalibration();
      else if (s.mode === "placingDoor" || s.mode === "placingWindow") s.setMode("idle");
      else {
        s.setSelectedWallKey(null);
        s.setSelectedVertexId(null);
        s.setSelectedDoorId(null);
        s.setSelectedWindowId(null);
        s.setSelectedFurnitureId(null);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  const wallLookup = useCallback((wallKey) => wallSegments.find((w) => w.key === wallKey), [wallSegments]);

  const flipDoorHinge = (id) => {
    pushHistory();
    setDoors((ds) => ds.map((d) => (d.id === id ? { ...d, hinge: d.hinge === "start" ? "end" : "start" } : d)));
  };
  const mirrorDoorSwing = (id) => {
    pushHistory();
    setDoors((ds) => ds.map((d) => (d.id === id ? { ...d, swingSide: d.swingSide * -1 } : d)));
  };
  const deleteDoor = (id) => {
    pushHistory();
    setDoors((ds) => ds.filter((d) => d.id !== id));
    if (selectedDoorId === id) setSelectedDoorId(null);
  };
  const setDoorWidth = (id, inches) =>
    setDoors((ds) =>
      ds.map((d) => {
        if (d.id !== id) return d;
        const wall = wallLookup(d.wallKey);
        const wallLenInches = wall ? dist(wall.a, wall.b) * scale : inches;
        const widthInches = Math.max(12, Math.min(inches, wallLenInches * 0.9));
        const minT = widthInches / 2 / wallLenInches;
        return { ...d, widthInches, t: Math.max(minT, Math.min(1 - minT, d.t)) };
      })
    );

  const deleteWindow = (id) => {
    pushHistory();
    setWindows((ws) => ws.filter((w) => w.id !== id));
    if (selectedWindowId === id) setSelectedWindowId(null);
  };
  const setWindowWidth = (id, inches) =>
    setWindows((ws) =>
      ws.map((w) => {
        if (w.id !== id) return w;
        const wall = wallLookup(w.wallKey);
        const wallLenInches = wall ? dist(wall.a, wall.b) * scale : inches;
        const widthInches = Math.max(6, Math.min(inches, wallLenInches * 0.9));
        const minT = widthInches / 2 / wallLenInches;
        return { ...w, widthInches, t: Math.max(minT, Math.min(1 - minT, w.t)) };
      })
    );

  /* ---------------- furniture ---------------- */

  const addFurniture = (roomId, preset) => {
    const room = rooms.find((r) => r.id === roomId);
    const pts = room ? room.vertexIds.map((id) => vertexMap.get(id)).filter(Boolean) : [];
    const c = pts.length ? centroidOf(pts) : { x: 0, y: 0 };
    pushHistory();
    const id = nextId.current++;
    const height = preset.height ?? null;
    setFurniture((f) => [
      ...f,
      {
        id,
        roomId,
        name: preset.name,
        category: preset.category,
        width: preset.width,
        depth: preset.depth,
        height,
        rotation: 0,
        x: c.x,
        y: c.y,
        avoidWindows: height != null ? height > SILL_HEIGHT_IN : preset.category === "Storage" || preset.category === "Bed",
        link: "",
        isAnchor: !!preset.isAnchor,
        centerpiece: !!preset.centerpiece,
      },
    ]);
    setSelectedFurnitureId(id);
    return id;
  };
  const deleteFurniture = (id) => {
    pushHistory();
    setFurniture((f) => f.filter((it) => it.id !== id));
    if (selectedFurnitureId === id) setSelectedFurnitureId(null);
  };
  const renameFurniture = (id, name) => setFurniture((f) => f.map((it) => (it.id === id ? { ...it, name } : it)));
  const setFurnitureCategory = (id, category) => {
    pushHistory();
    setFurniture((f) => f.map((it) => (it.id === id ? { ...it, category } : it)));
  };
  const setFurnitureDims = (id, width, depth) =>
    setFurniture((f) => f.map((it) => (it.id === id ? { ...it, width: Math.max(1, width), depth: Math.max(1, depth) } : it)));
  const setFurnitureHeight = (id, height) =>
    setFurniture((f) => f.map((it) => (it.id === id ? { ...it, height, avoidWindows: height != null ? height > SILL_HEIGHT_IN : it.avoidWindows } : it)));
  const setFurnitureLink = (id, link) => setFurniture((f) => f.map((it) => (it.id === id ? { ...it, link } : it)));
  const toggleFurnitureAvoidWindows = (id) => {
    pushHistory();
    setFurniture((f) => f.map((it) => (it.id === id ? { ...it, avoidWindows: !it.avoidWindows } : it)));
  };
  const rotateFurniture = (id) => {
    pushHistory();
    setFurniture((f) => f.map((it) => (it.id === id ? { ...it, rotation: (it.rotation + 90) % 360 } : it)));
  };

  const onFurnitureMouseDown = (id) => (e) => {
    if (mode !== "idle") return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pushHistory();
    setDraggingFurnitureId(id);
    setSelectedFurnitureId(id);
    setSelectedDoorId(null);
    setSelectedWindowId(null);
    setSelectedWallKey(null);
    setSelectedVertexId(null);
  };

  const runAutoArrange = (roomId) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room || !scale) return;
    const withFlags = furniture
      .filter((it) => it.roomId === roomId)
      .map((it) => ({ id: it.id, width: it.width, depth: it.depth, avoidWindows: it.avoidWindows, isAnchor: !!it.isAnchor, centerpiece: !!it.centerpiece }));
    const { placed: result, unplacedIds } = autoPlaceFurniture(room, vertexMap, doors, windows, scale, withFlags);
    if (result.length) {
      pushHistory();
      setFurniture((f) =>
        f.map((it) => {
          const r = result.find((res) => res.id === it.id);
          return r ? { ...it, x: r.x, y: r.y, rotation: r.rotation } : it;
        })
      );
    }
    setAutoArrangeWarning(
      unplacedIds.length
        ? `Couldn't fit ${unplacedIds.length} item${unplacedIds.length > 1 ? "s" : ""} against a wall — try a smaller size or remove something.`
        : null
    );
  };

  /* ---------------- vertex dragging / wall selection ---------------- */

  const onVertexMouseDown = (id) => (e) => {
    if (mode !== "idle") return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pushHistory();
    dragStartRef.current = { clientX: e.clientX, clientY: e.clientY, moved: false };
    setDraggingVertexId(id);
    setSelectedWallKey(null);
    setSelectedDoorId(null);
    setSelectedWindowId(null);
    setSelectedFurnitureId(null);
  };

  const onWallPointerDown = (wallKey) => (e) => {
    if (mode !== "idle") return;
    e.stopPropagation();
    setSelectedWallKey(wallKey);
    setSelectedDoorId(null);
    setSelectedWindowId(null);
    setSelectedVertexId(null);
    setSelectedFurnitureId(null);
    setWallLengthInput("");
  };

  const onDoorMouseDown = (id) => (e) => {
    if (mode !== "idle") return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pushHistory();
    setDraggingDoorId(id);
    setSelectedDoorId(id);
    setSelectedWindowId(null);
    setSelectedWallKey(null);
    setSelectedVertexId(null);
    setSelectedFurnitureId(null);
  };
  const onWindowMouseDown = (id) => (e) => {
    if (mode !== "idle") return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pushHistory();
    setDraggingWindowId(id);
    setSelectedWindowId(id);
    setSelectedDoorId(null);
    setSelectedWallKey(null);
    setSelectedVertexId(null);
    setSelectedFurnitureId(null);
  };

  const onSvgMouseMove = (e) => {
    if (!image) return;
    const pt = clientToImageCoords(e.clientX, e.clientY);
    setMousePos(pt);

    if (draggingVertexId != null) {
      if (dragStartRef.current) {
        const dxScreen = e.clientX - dragStartRef.current.clientX;
        const dyScreen = e.clientY - dragStartRef.current.clientY;
        if (Math.hypot(dxScreen, dyScreen) > 5) dragStartRef.current.moved = true;
      }
      setVertices((vs) => vs.map((v) => (v.id === draggingVertexId ? { ...v, x: pt.x, y: pt.y } : v)));
      const touched = wallSegments.filter((w) => w.a.id === draggingVertexId || w.b.id === draggingVertexId);
      if (touched.length && scale) {
        const lenByKey = new Map();
        touched.forEach((w) => {
          const aPt = w.a.id === draggingVertexId ? pt : w.a;
          const bPt = w.b.id === draggingVertexId ? pt : w.b;
          lenByKey.set(w.key, dist(aPt, bPt) * scale);
        });
        setDoors((ds) => ds.map((d) => (lenByKey.has(d.wallKey) ? reclampOpening(d, lenByKey.get(d.wallKey), 12) : d)));
        setWindows((ws) => ws.map((w) => (lenByKey.has(w.wallKey) ? reclampOpening(w, lenByKey.get(w.wallKey), 6) : w)));
      }
    }
    if (draggingDoorId != null) {
      const door = doors.find((d) => d.id === draggingDoorId);
      const wall = door && wallLookup(door.wallKey);
      if (wall) {
        const res = projectOntoSegment(pt, wall.a, wall.b);
        const wallLenInches = dist(wall.a, wall.b) * scale;
        const minT = door.widthInches / 2 / wallLenInches;
        const t = Math.max(minT, Math.min(1 - minT, res.t));
        setDoors((ds) => ds.map((d) => (d.id === draggingDoorId ? { ...d, t } : d)));
      }
    }
    if (draggingWindowId != null) {
      const win = windows.find((w) => w.id === draggingWindowId);
      const wall = win && wallLookup(win.wallKey);
      if (wall) {
        const res = projectOntoSegment(pt, wall.a, wall.b);
        const wallLenInches = dist(wall.a, wall.b) * scale;
        const minT = win.widthInches / 2 / wallLenInches;
        const t = Math.max(minT, Math.min(1 - minT, res.t));
        setWindows((ws) => ws.map((w) => (w.id === draggingWindowId ? { ...w, t } : w)));
      }
    }
    if (draggingFurnitureId != null) {
      const clampedX = Math.max(0, Math.min(image.w, pt.x));
      const clampedY = Math.max(0, Math.min(image.h, pt.y));
      setFurniture((f) => f.map((it) => (it.id === draggingFurnitureId ? { ...it, x: clampedX, y: clampedY } : it)));
    }
  };

  const onSvgMouseUp = () => {
    if (draggingVertexId != null && dragStartRef.current && !dragStartRef.current.moved) {
      setSelectedVertexId(draggingVertexId);
      setSelectedWallKey(null);
      setSelectedDoorId(null);
      setSelectedWindowId(null);
      setSelectedFurnitureId(null);
    }
    if (draggingFurnitureId != null) {
      const dragged = furniture.find((it) => it.id === draggingFurnitureId);
      if (dragged) {
        const droppedRoom = roomContainingPoint({ x: dragged.x, y: dragged.y }, rooms, vertexMap);
        if (droppedRoom && droppedRoom.id !== dragged.roomId) {
          setFurniture((f) => f.map((it) => (it.id === draggingFurnitureId ? { ...it, roomId: droppedRoom.id } : it)));
          setAddFurnitureRoomId(droppedRoom.id);
        }
      }
    }
    dragStartRef.current = null;
    setDraggingVertexId(null);
    setDraggingDoorId(null);
    setDraggingWindowId(null);
    setDraggingFurnitureId(null);
  };

  /* ---------------- derived: areas + grid + preview ---------------- */

  const voidAreas = useMemo(() => {
    return voids.map((v) => {
      const pts = v.vertexIds.map((id) => vertexMap.get(id)).filter(Boolean);
      const px2 = shoelaceAreaPx(pts);
      return { id: v.id, sqInches: scale ? px2 * scale * scale : 0, centroid: centroidOf(pts) };
    });
  }, [voids, vertexMap, scale]);

  const roomAreas = useMemo(() => {
    return rooms.map((room) => {
      const pts = room.vertexIds.map((id) => vertexMap.get(id)).filter(Boolean);
      const grossPx2 = shoelaceAreaPx(pts);
      const grossSqInches = scale ? grossPx2 * scale * scale : 0;
      const enclosedVoidSqInches = voidAreas
        .filter((va) => va.centroid && pointInPolygon(va.centroid, pts))
        .reduce((s, va) => s + va.sqInches, 0);
      const sqInches = Math.max(0, grossSqInches - enclosedVoidSqInches);

      const edgeInsetsPx = room.vertexIds.map((aId, index) => {
        if (!scale) return 0;
        const bId = room.vertexIds[(index + 1) % room.vertexIds.length];
        const key = wallKeyFor(aId, bId);
        const props = wallProps[key] || { thickness: DEFAULT_WALL_THICKNESS_IN, open: false };
        return props.open ? 0 : props.thickness / 2 / scale;
      });
      const interiorPts = scale ? insetPolygon(pts, edgeInsetsPx) : pts;
      const interiorGrossSqInches = scale ? shoelaceAreaPx(interiorPts) * scale * scale : 0;
      const interiorSqInches = Math.max(0, interiorGrossSqInches - enclosedVoidSqInches);
      return { id: room.id, sqInches, grossSqInches, interiorSqInches };
    });
  }, [rooms, vertexMap, scale, voidAreas, wallProps]);

  const totalAreaSqInches = roomAreas.reduce((sum, r) => sum + r.sqInches, 0);
  const totalInteriorSqInches = roomAreas.reduce((sum, r) => sum + r.interiorSqInches, 0);

  const gridLines = useMemo(() => {
    if (!scale || !image) return [];
    const stepInches = unit === "imperial" ? 12 : INCH_PER_METER;
    const stepPx = stepInches / scale;
    if (stepPx < 6) return [];
    const lines = [];
    for (let x = 0; x < image.w; x += stepPx) lines.push({ type: "v", pos: x });
    for (let y = 0; y < image.h; y += stepPx) lines.push({ type: "h", pos: y });
    return lines;
  }, [scale, image, unit]);

  const previewPoint = useMemo(() => {
    if (!mousePos || mode !== "drawing" || currentChain.length === 0) return mousePos;
    const nearby = findNearbyVertex(mousePos);
    if (nearby) return nearby;
    const wallTarget = findNearbyWallPoint(mousePos);
    if (wallTarget) return wallTarget.point;
    if (!angleSnap) return mousePos;
    const anchor = vertexMap.get(currentChain[currentChain.length - 1]);
    if (!anchor) return mousePos;
    const dx = mousePos.x - anchor.x;
    const dy = mousePos.y - anchor.y;
    const d = Math.hypot(dx, dy);
    if (d <= 2) return mousePos;
    const angle = Math.atan2(dy, dx);
    const snapStep = Math.PI / 4;
    const nearestSnap = Math.round(angle / snapStep) * snapStep;
    const snapped = { x: anchor.x + Math.cos(nearestSnap) * d, y: anchor.y + Math.sin(nearestSnap) * d };
    const snappedVertex = findNearbyVertex(snapped);
    if (snappedVertex) return snappedVertex;
    const snappedWall = findNearbyWallPoint(snapped);
    return snappedWall ? snappedWall.point : snapped;
  }, [mousePos, mode, currentChain, angleSnap, vertexMap, findNearbyVertex, findNearbyWallPoint]);

  /* ---------------- export ---------------- */

  const svgToCanvas = async (scaleFactor = 2) => {
    const svgEl = svgRef.current;
    const clone = svgEl.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", image.w);
    clone.setAttribute("height", image.h);
    const svgString = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.w * scaleFactor;
    canvas.height = image.h * scaleFactor;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FBF8F1";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return canvas;
  };

  const exportSVG = async () => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", image.w);
    clone.setAttribute("height", image.h);
    const svgString = new XMLSerializer().serializeToString(clone);
    await saveOrShareFile(new Blob([svgString], { type: "image/svg+xml" }), "floorplan.svg");
  };

  const exportPNG = async () => {
    if (!image) return;
    setExporting("png");
    try {
      const canvas = await svgToCanvas(2);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob) await saveOrShareFile(blob, "floorplan.png");
    } catch {
      /* export failed silently; other formats remain available */
    } finally {
      setExporting(null);
    }
  };

  const exportPDF = async () => {
    if (!image) return;
    setExporting("pdf");
    try {
      const canvas = await svgToCanvas(2);
      const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const base64 = jpegDataUrl.split(",")[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      let ptW = canvas.width;
      let ptH = canvas.height;
      const maxPt = 3000;
      if (ptW > maxPt || ptH > maxPt) {
        const f = maxPt / Math.max(ptW, ptH);
        ptW *= f;
        ptH *= f;
      }
      const blob = buildJpegPdf(bytes, canvas.width, canvas.height, ptW, ptH);
      await saveOrShareFile(blob, "floorplan.pdf");
    } catch {
      /* export failed silently; SVG/PNG remain available */
    } finally {
      setExporting(null);
    }
  };

  const exportDXF = async () => {
    if (!scale) return;
    const dxfString = buildDxf({ wallSegments, wallProps, doors, windows, rooms, furniture, vertexMap, scale, unit });
    await saveOrShareFile(new Blob([dxfString], { type: "application/dxf" }), "floorplan.dxf");
  };

  const printScaleOptions = PRINT_SCALES[unit === "imperial" ? "imperial" : "metric"];
  const defaultScale = printScaleOptions.find((s) => s.default) || printScaleOptions[0];
  const activeScaleKey = printSettings.scaleKey || defaultScale.key;
  const activeScale = printScaleOptions.find((s) => s.key === activeScaleKey) || defaultScale;

  const printPreview = useMemo(() => {
    if (!scale || !image) return null;
    const paper = PAPER_SIZES[printSettings.paperKey];
    if (!paper) return null;
    const realWidthIn = image.w * scale;
    const realHeightIn = image.h * scale;
    return { realWidthIn, realHeightIn, paper };
  }, [scale, image, printSettings]);

  const exportPrintPDF = async () => {
    if (!image || !scale || !svgRef.current) return;
    setExporting("print");
    try {
      const { blob } = await renderPrintPdf({
        svgEl: svgRef.current,
        imageW: image.w,
        imageH: image.h,
        scale,
        paperKey: printSettings.paperKey,
        scaleRatio: activeScale.ratio,
        scaleLabel: activeScale.label,
      });
      await saveOrShareFile(blob, "floorplan-print.pdf");
    } catch {
      /* print export failed; snapshot PDF/PNG remain available */
    } finally {
      setExporting(null);
    }
  };

  const scaleBar = useMemo(() => {
    if (!scale) return null;
    const targetPx = 110;
    const options =
      unit === "imperial"
        ? [1, 2, 3, 5, 10, 20, 50, 100].map((f) => ({ inches: f * 12, label: `${f} ft` }))
        : [0.5, 1, 2, 5, 10, 20, 50].map((m) => ({ inches: m * INCH_PER_METER, label: `${m} m` }));
    let best = { ...options[0], px: options[0].inches / scale };
    let bestDiff = Infinity;
    options.forEach((o) => {
      const px = o.inches / scale;
      const diff = Math.abs(px - targetPx);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = { ...o, px };
      }
    });
    return best;
  }, [scale, unit]);

  /* ---------------- public API ---------------- */

  return {
    svgRef, fileInputRef,
    unit, setUnit, image, scale, mode, setMode,
    calPoints, calLengthInput, setCalLengthInput, calibrationLine, startCalibration, confirmCalibration, cancelCalibration,
    vertices, vertexMap, wallSegments, rooms, voids, drawKind, currentChain, mousePos, previewPoint,
    draggingVertexId, pendingRoom, roomNameInput, setRoomNameInput, roomTypeInput, setRoomTypeInput,
    startDrawingRoom, undoLastPoint, cancelDrawingRoom, confirmRoomName, cancelRoomName,
    deleteRoom, renameRoom, retypeRoom, deleteVoid, renameVoid, angleSnap, setAngleSnap,
    doors, windows, selectedDoorId, setSelectedDoorId, selectedWindowId, setSelectedWindowId,
    togglePlacingDoor, togglePlacingWindow, flipDoorHinge, mirrorDoorSwing, deleteDoor, setDoorWidth,
    deleteWindow, setWindowWidth, onDoorMouseDown, onWindowMouseDown,
    selectedWallKey, setSelectedWallKey, selectedWall, wallLengthInput, setWallLengthInput, setWallLength,
    getWallProps, setWallThickness, toggleWallOpen, onWallPointerDown, wallLoopCounts,
    extBatchInput, setExtBatchInput, intBatchInput, setIntBatchInput, applyExteriorThickness, applyInteriorThickness,
    selectedVertexId, setSelectedVertexId, canDeleteSelectedVertex, deleteVertexEverywhere, onVertexMouseDown,
    overlappingRoomIds, escapedVoidIds, furnitureWarnings,
    roomAreas, voidAreas, totalAreaSqInches, totalInteriorSqInches, showInteriorArea, setShowInteriorArea,
    furniture, selectedFurnitureId, setSelectedFurnitureId, addFurnitureRoomId, setAddFurnitureRoomId,
    autoArrangeWarning, setAutoArrangeWarning, addFurniture, deleteFurniture, renameFurniture,
    setFurnitureCategory, setFurnitureDims, setFurnitureHeight, setFurnitureLink, toggleFurnitureAvoidWindows,
    rotateFurniture, onFurnitureMouseDown, runAutoArrange, FURNITURE_PRESETS,
    handleImageUpload, handleCameraCapture, handleSvgClick, onSvgMouseMove, onSvgMouseUp, gridLines,
    northAngle, setNorthAngle, scaleBar, imperialFraction, setImperialFraction,
    exporting, exportSVG, exportPNG, exportPDF, exportDXF, exportPrintPDF,
    printSettings, setPrintSettings, printScaleOptions, activeScale, printPreview, PAPER_SIZES,
    saveStatus, clearSavedPlan,
    canUndo, canRedo, undo, redo, pushHistory,
  };
}
