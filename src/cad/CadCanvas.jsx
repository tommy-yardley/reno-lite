import React, { useMemo, useRef, useState } from "react";
import { Hand, Lock, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { distance, openingSpan, polygonArea } from "./geometry";
import { WORKSPACE } from "./useCadState";
import { lengthToDisplay } from "../lib/units";
import { OBJECT_CATALOG } from "./catalog";

export default function CadCanvas({ cad }) {
  const [view, setView] = useState({ x: 0, y: 0, width: WORKSPACE.width, height: WORKSPACE.height });
  const [panMode, setPanMode] = useState(false);
  const panStart = useRef(null);
  const {
    svgRef,
    nodes,
    walls,
    rooms,
    openings,
    objects,
    nodeMap,
    unit,
    tool,
    activeNodeId,
    selectedWallId,
    selectedOpeningId,
    selectedObjectId,
    pointer,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onNodePointerDown,
    onWallPointerDown,
    onOpeningPointerDown,
    onObjectPointerDown,
    isNodeLocked,
  } = cad;

  const visibleNodeIds = new Set();
  if (tool === "wall") nodes.forEach((node) => visibleNodeIds.add(node.id));
  const selectedWall = walls.find((wall) => wall.id === selectedWallId);
  if (selectedWall) {
    visibleNodeIds.add(selectedWall.startNodeId);
    visibleNodeIds.add(selectedWall.endNodeId);
  }

  const previewMeasurement = useMemo(() => {
    const anchor = activeNodeId != null ? nodeMap.get(activeNodeId) : null;
    if (!anchor || !pointer) return null;
    const dx = pointer.x - anchor.x;
    const dy = pointer.y - anchor.y;
    const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    return { length: distance(anchor, pointer), angle };
  }, [activeNodeId, nodeMap, pointer]);

  const fitPlan = () => {
    if (!nodes.length) {
      setView({ x: 0, y: 0, width: WORKSPACE.width, height: WORKSPACE.height });
      return;
    }
    const padding = 48;
    const minX = Math.min(...nodes.map((node) => node.x)) - padding;
    const minY = Math.min(...nodes.map((node) => node.y)) - padding;
    const maxX = Math.max(...nodes.map((node) => node.x)) + padding;
    const maxY = Math.max(...nodes.map((node) => node.y)) + padding;
    setView({ x: minX, y: minY, width: Math.max(120, maxX - minX), height: Math.max(80, maxY - minY) });
  };

  const zoom = (factor) => setView((current) => {
    const width = Math.max(72, Math.min(WORKSPACE.width * 3, current.width * factor));
    const height = Math.max(48, Math.min(WORKSPACE.height * 3, current.height * factor));
    return { x: current.x + (current.width - width) / 2, y: current.y + (current.height - height) / 2, width, height };
  });

  const handlePointerDown = (event) => {
    if (panMode || event.button === 1) {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      panStart.current = { clientX: event.clientX, clientY: event.clientY, view };
      return;
    }
    onCanvasPointerDown(event);
  };

  const handlePointerMove = (event) => {
    if (panStart.current) {
      const rect = cad.svgRef.current.getBoundingClientRect();
      const dx = ((event.clientX - panStart.current.clientX) / rect.width) * panStart.current.view.width;
      const dy = ((event.clientY - panStart.current.clientY) / rect.height) * panStart.current.view.height;
      setView({ ...panStart.current.view, x: panStart.current.view.x - dx, y: panStart.current.view.y - dy });
      return;
    }
    onCanvasPointerMove(event);
  };

  const handlePointerUp = () => {
    panStart.current = null;
    onCanvasPointerUp();
  };

  return (
    <div className="relative min-h-[500px] h-[68vh] lg:h-[calc(100vh-170px)] overflow-hidden rounded-xl border border-[#D8CCB0] bg-[#FBF8F1] shadow-sm">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={(event) => { event.preventDefault(); zoom(event.deltaY > 0 ? 1.12 : 0.88); }}
        style={{ touchAction: "none", userSelect: "none", cursor: panMode ? "grab" : tool === "wall" ? "crosshair" : "default" }}
        aria-label="CAD drawing canvas"
      >
        <defs>
          <pattern id="minor-grid" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M 12 0 L 0 0 0 12" fill="none" stroke="#D8CCB0" strokeWidth="0.45" opacity="0.45" />
          </pattern>
          <pattern id="major-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <rect width="60" height="60" fill="url(#minor-grid)" />
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#9C9A91" strokeWidth="0.75" opacity="0.35" />
          </pattern>
        </defs>
        <rect width={WORKSPACE.width} height={WORKSPACE.height} fill="url(#major-grid)" />

        {rooms.map((room) => {
          const points = room.nodeIds.map((id) => nodeMap.get(id)).filter(Boolean);
          if (points.length < 3) return null;
          const center = {
            x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
            y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
          };
          return (
            <g key={room.id} style={{ pointerEvents: "none" }}>
              <polygon points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill={room.color || "#B9D8C2"} fillOpacity="0.34" />
              <text x={center.x} y={center.y - 3} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1B2B3A" className="serif">{room.name}</text>
              <text x={center.x} y={center.y + 10} textAnchor="middle" fontSize="7" fill="#5B6B78" className="mono">
                {unit === "metric" ? `${(polygonArea(points) / (39.3700787 ** 2)).toFixed(1)} m²` : `${(polygonArea(points) / 144).toFixed(1)} ft²`}
              </text>
            </g>
          );
        })}

        {walls.map((wall) => {
          const start = nodeMap.get(wall.startNodeId);
          const end = nodeMap.get(wall.endNodeId);
          if (!start || !end) return null;
          const selected = wall.id === selectedWallId;
          const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
          return (
            <g key={wall.id} onPointerDown={onWallPointerDown(wall.id)} style={{ cursor: tool === "select" ? (wall.locked ? "not-allowed" : "move") : tool === "wall" ? "crosshair" : "pointer" }}>
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="transparent" strokeWidth="14" />
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={selected ? "#2F78C4" : wall.locked ? "#5B6B78" : "#1B2B3A"}
                strokeWidth={Math.max(2.5, wall.thicknessInches)}
                strokeLinecap="square"
                style={{ pointerEvents: "none" }}
              />
              {(selected || tool === "wall") && (
                <g style={{ pointerEvents: "none" }}>
                  <rect x={midpoint.x - 25} y={midpoint.y - 10} width="50" height="16" rx="3" fill="#FBF8F1" opacity="0.92" />
                  <text x={midpoint.x} y={midpoint.y + 2} textAnchor="middle" fontSize="8" fill="#5B6B78" className="mono">
                    {lengthToDisplay(distance(start, end), unit, unit === "imperial")}
                  </text>
                  {wall.locked && <Lock x={midpoint.x + 18} y={midpoint.y - 7} size={9} color="#B8863E" />}
                </g>
              )}
            </g>
          );
        })}

        {activeNodeId != null && pointer && nodeMap.get(activeNodeId) && (
          <line
            x1={nodeMap.get(activeNodeId).x}
            y1={nodeMap.get(activeNodeId).y}
            x2={pointer.x}
            y2={pointer.y}
            stroke="#B8863E"
            strokeWidth="2"
            strokeDasharray="6 4"
            style={{ pointerEvents: "none" }}
          />
        )}

        {openings.map((opening) => {
          const wall = walls.find((item) => item.id === opening.wallId);
          const start = wall && nodeMap.get(wall.startNodeId);
          const end = wall && nodeMap.get(wall.endNodeId);
          if (!wall || !start || !end) return null;
          const span = openingSpan(start, end, opening.t, opening.widthInches);
          const normal = { x: -span.direction.y, y: span.direction.x };
          const selected = opening.id === selectedOpeningId;
          if (opening.type === "window") {
            return (
              <g key={opening.id} onPointerDown={onOpeningPointerDown(opening.id)} style={{ cursor: "pointer" }}>
                <line x1={span.start.x} y1={span.start.y} x2={span.end.x} y2={span.end.y} stroke="#FBF8F1" strokeWidth={Math.max(8, wall.thicknessInches + 3)} />
                <line x1={span.start.x} y1={span.start.y} x2={span.end.x} y2={span.end.y} stroke={selected ? "#2F78C4" : "#5E86A8"} strokeWidth="3" />
                <line x1={span.start.x + normal.x * 4} y1={span.start.y + normal.y * 4} x2={span.end.x + normal.x * 4} y2={span.end.y + normal.y * 4} stroke="#5E86A8" strokeWidth="1" />
              </g>
            );
          }
          const hinge = span.start;
          const leafEnd = { x: hinge.x + normal.x * span.width * opening.swing, y: hinge.y + normal.y * span.width * opening.swing };
          const sweep = opening.swing > 0 ? 1 : 0;
          return (
            <g key={opening.id} onPointerDown={onOpeningPointerDown(opening.id)} style={{ cursor: "pointer" }}>
              <line x1={span.start.x} y1={span.start.y} x2={span.end.x} y2={span.end.y} stroke="#FBF8F1" strokeWidth={Math.max(8, wall.thicknessInches + 3)} />
              <line x1={hinge.x} y1={hinge.y} x2={leafEnd.x} y2={leafEnd.y} stroke={selected ? "#2F78C4" : "#B8863E"} strokeWidth="2" />
              <path d={`M ${span.end.x} ${span.end.y} A ${span.width} ${span.width} 0 0 ${sweep} ${leafEnd.x} ${leafEnd.y}`} fill="none" stroke="#B8863E" strokeWidth="1" strokeDasharray="3 3" />
            </g>
          );
        })}

        {objects.map((object) => {
          const preset = OBJECT_CATALOG[object.kind] || {};
          const selected = object.id === selectedObjectId;
          const warning = cad.warningObjectIds.includes(object.id);
          if (object.mount === "wall") {
            const wall = walls.find((item) => item.id === object.wallId);
            const start = wall && nodeMap.get(wall.startNodeId);
            const end = wall && nodeMap.get(wall.endNodeId);
            if (!start || !end) return null;
            const center = { x: start.x + (end.x - start.x) * object.t, y: start.y + (end.y - start.y) * object.t };
            const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
            const width = object.kind === "radiator" ? object.widthInches : 16;
            return (
              <g key={object.id} transform={`translate(${center.x} ${center.y}) rotate(${angle})`} onPointerDown={onObjectPointerDown(object.id)} style={{ cursor: "pointer" }}>
                <rect x={-width / 2} y="-8" width={width} height="16" rx="2" fill="#FBF8F1" stroke={selected ? "#2F78C4" : object.category === "Electrical" ? "#D26A3D" : "#8A6D4B"} strokeWidth={selected ? 2 : 1.5} />
                <text x="0" y="2.5" textAnchor="middle" fontSize="6" fontWeight="600" fill="#1B2B3A" className="mono">{preset.symbol}</text>
              </g>
            );
          }
          if (object.mount === "floor") {
            return (
              <g key={object.id} transform={`translate(${object.x} ${object.y}) rotate(${object.rotation})`} onPointerDown={onObjectPointerDown(object.id)} style={{ cursor: "move" }}>
                {(selected || warning) && <rect x={-object.widthInches / 2 - 3} y={-object.depthInches / 2 - 3} width={object.widthInches + 6} height={object.depthInches + 6} fill="none" stroke={warning ? "#B2483A" : "#2F78C4"} strokeWidth="2" strokeDasharray="4 3" />}
                <rect x={-object.widthInches / 2} y={-object.depthInches / 2} width={object.widthInches} height={object.depthInches} rx="3" fill={warning ? "#E8B7AE" : "#D7C7A7"} fillOpacity="0.82" stroke={warning ? "#B2483A" : "#7A6F5C"} strokeWidth="1.5" />
                <text x="0" y="2.5" textAnchor="middle" fontSize="7" fill="#1B2B3A" className="mono" style={{ pointerEvents: "none" }}>{object.name}</text>
              </g>
            );
          }
          return (
            <g key={object.id} transform={`translate(${object.x} ${object.y})`} onPointerDown={onObjectPointerDown(object.id)} style={{ cursor: "move" }}>
              <circle r={selected ? 11 : 9} fill="#FBF8F1" stroke={selected ? "#2F78C4" : "#D4A72C"} strokeWidth="2" />
              <line x1="-6" y1="0" x2="6" y2="0" stroke="#D4A72C" strokeWidth="1.5" />
              <line x1="0" y1="-6" x2="0" y2="6" stroke="#D4A72C" strokeWidth="1.5" />
              <text x="0" y="3" textAnchor="middle" fontSize="5" fontWeight="700" fill="#1B2B3A" className="mono">{preset.symbol}</text>
            </g>
          );
        })}

        {nodes
          .filter((node) => visibleNodeIds.has(node.id))
          .map((node) => {
            const locked = isNodeLocked(node.id);
            const active = node.id === activeNodeId;
            return (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r={active ? 6 : 4.5}
                fill={locked ? "#5B6B78" : active ? "#B8863E" : "#FBF8F1"}
                stroke={active ? "#1B2B3A" : "#B8863E"}
                strokeWidth="1.5"
                onPointerDown={onNodePointerDown(node.id)}
                style={{ cursor: locked && tool !== "wall" ? "not-allowed" : tool === "wall" ? "crosshair" : "move" }}
              />
            );
          })}
      </svg>

      <div className="absolute right-3 top-3 flex overflow-hidden rounded-md border border-[#D8CCB0] bg-[#FBF8F1] shadow-sm">
        <button onClick={() => setPanMode((value) => !value)} className="border-r border-[#D8CCB0] p-2" style={{ color: panMode ? "#B8863E" : "#5E86A8" }} title="Pan"><Hand size={14} /></button>
        <button onClick={() => zoom(0.8)} className="border-r border-[#D8CCB0] p-2 text-[#5E86A8]" title="Zoom in"><ZoomIn size={14} /></button>
        <button onClick={() => zoom(1.25)} className="border-r border-[#D8CCB0] p-2 text-[#5E86A8]" title="Zoom out"><ZoomOut size={14} /></button>
        <button onClick={fitPlan} className="p-2 text-[#5E86A8]" title="Fit plan"><Maximize2 size={14} /></button>
      </div>

      {previewMeasurement && (
        <div className="mono absolute bottom-3 left-3 rounded-md border border-[#D8CCB0] bg-[#FBF8F1]/95 px-2 py-1 text-[10px] text-[#5B6B78] shadow-sm">
          {lengthToDisplay(previewMeasurement.length, unit, unit === "imperial")} · {previewMeasurement.angle.toFixed(0)}°
        </div>
      )}

      {cad.drawingWarnings.length > 0 && (
        <div className="absolute left-3 top-3 max-w-xs rounded-md border border-[#E0954A] bg-[#FFF7E8]/95 px-2 py-1 text-[10px] text-[#8B5A24] shadow-sm">
          {cad.drawingWarnings[0]}{cad.drawingWarnings.length > 1 ? ` (+${cad.drawingWarnings.length - 1} more)` : ""}
        </div>
      )}

      {cad.designWarnings.length > 0 && (
        <div className="absolute bottom-3 right-3 max-w-xs rounded-md border border-[#B2483A] bg-[#FFF1EE]/95 px-2 py-1 text-[10px] text-[#8D342A] shadow-sm">
          {cad.designWarnings[0]}{cad.designWarnings.length > 1 ? ` (+${cad.designWarnings.length - 1} more)` : ""}
        </div>
      )}

      {walls.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rounded-lg border border-[#D8CCB0] bg-[#FBF8F1]/95 px-5 py-4 text-center shadow-sm">
            <p className="serif font-semibold text-[#1B2B3A]">Draw the measured plan</p>
            <p className="mt-1 max-w-xs text-xs text-[#5B6B78]">Click to place walls, or type the next exact length while drawing.</p>
          </div>
        </div>
      )}
    </div>
  );
}
