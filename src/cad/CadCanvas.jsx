import React from "react";
import { Lock } from "lucide-react";
import { distance } from "./geometry";
import { WORKSPACE } from "./useCadState";
import { lengthToDisplay } from "../lib/units";

export default function CadCanvas({ cad }) {
  const {
    svgRef,
    nodes,
    walls,
    nodeMap,
    unit,
    tool,
    activeNodeId,
    selectedWallId,
    pointer,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onNodePointerDown,
    onWallPointerDown,
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
