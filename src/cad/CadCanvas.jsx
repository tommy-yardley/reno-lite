import React from "react";
import { Lock } from "lucide-react";
import { distance, openingSpan, polygonArea } from "./geometry";
import { WORKSPACE } from "./useCadState";
import { lengthToDisplay } from "../lib/units";

export default function CadCanvas({ cad }) {
  const {
    svgRef,
    nodes,
    walls,
    rooms,
    openings,
    nodeMap,
    unit,
    tool,
    activeNodeId,
    selectedWallId,
    selectedOpeningId,
    pointer,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onNodePointerDown,
    onWallPointerDown,
    onOpeningPointerDown,
    isNodeLocked,
  } = cad;

  const visibleNodeIds = new Set();
  if (tool === "wall") nodes.forEach((node) => visibleNodeIds.add(node.id));
  const selectedWall = walls.find((wall) => wall.id === selectedWallId);
  if (selectedWall) {
    visibleNodeIds.add(selectedWall.startNodeId);
    visibleNodeIds.add(selectedWall.endNodeId);
  }

  return (
    <div className="relative min-h-[500px] h-[68vh] lg:h-[calc(100vh-170px)] overflow-hidden rounded-xl border border-[#D8CCB0] bg-[#FBF8F1] shadow-sm">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WORKSPACE.width} ${WORKSPACE.height}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerUp}
        style={{ touchAction: "none", userSelect: "none", cursor: tool === "wall" ? "crosshair" : "default" }}
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
            <g key={wall.id} onPointerDown={onWallPointerDown(wall.id)}>
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

      {walls.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rounded-lg border border-[#D8CCB0] bg-[#FBF8F1]/95 px-5 py-4 text-center shadow-sm">
            <p className="serif font-semibold text-[#1B2B3A]">Draw the measured plan</p>
            <p className="mt-1 max-w-xs text-xs text-[#5B6B78]">Click to place walls. Enter exact dimensions after selecting a wall.</p>
          </div>
        </div>
      )}
    </div>
  );
}
