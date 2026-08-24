import React, { useMemo, useRef, useState } from "react";
import { Hand, Lock, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { distance } from "./geometry";
import { WORKSPACE } from "./useCadState";
import { lengthToDisplay } from "../lib/units";
import { buildRenderModel } from "./renderModel";

export default function CadCanvas({ cad }) {
  const [view, setView] = useState({ x: 0, y: 0, width: WORKSPACE.width, height: WORKSPACE.height });
  const [panMode, setPanMode] = useState(false);
  const panStart = useRef(null);
  const {
    svgRef,
    nodes,
    walls,
    nodeMap,
    unit,
    tool,
    activeNodeId,
    selectedWallId,
    selectedOpeningId,
    selectedOpeningIds,
    selectedObjectId,
    selectedRoomId,
    pointer,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onNodePointerDown,
    onWallPointerDown,
    onOpeningPointerDown,
    onOpeningResizePointerDown,
    onObjectPointerDown,
    onRoomPointerDown,
    isNodeLocked,
  } = cad;
  const renderModel = useMemo(() => buildRenderModel(cad.project), [cad.project]);
  const layerStyle = (layer) => ({
    display: cad.layerSettings[layer].visible ? undefined : "none",
    opacity: cad.activeLayer && cad.activeLayer !== layer ? 0.18 : 1,
    pointerEvents: cad.layerSettings[layer].locked ? "none" : undefined,
  });

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
    <div className="relative h-full min-h-0 overflow-hidden rounded-xl border border-[#D8CCB0] bg-[#FBF8F1] shadow-sm">
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

        {renderModel.rooms.map(({ source: room, points, center }) => {
          return (
            <g key={room.id} style={layerStyle("architecture")}>
              <polygon onPointerDown={onRoomPointerDown(room.id)} points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill={room.classification === "void" ? "#A8A8A2" : room.color || "#B9D8C2"} fillOpacity={room.classification === "void" ? "0.5" : "0.34"} stroke={room.id === selectedRoomId ? "#2F78C4" : room.classification === "void" ? "#777770" : "none"} strokeWidth={room.id === selectedRoomId ? "2" : "1"} strokeDasharray={room.classification === "void" ? "5 3" : undefined} style={{ cursor: tool === "select" ? "pointer" : "default" }} />
              <text x={center.x} y={center.y - 3} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1B2B3A" className="serif" style={{ pointerEvents: "none" }}>{room.name}</text>
              <text x={center.x} y={center.y + 10} textAnchor="middle" fontSize="7" fill="#5B6B78" className="mono">
                {room.classification === "void" ? "VOID · " : ""}{unit === "metric" ? `${(cad.roomAreas.find((item) => item.id === room.id)?.areaSqInches / (39.3700787 ** 2)).toFixed(1)} m²` : `${(cad.roomAreas.find((item) => item.id === room.id)?.areaSqInches / 144).toFixed(1)} ft²`}
              </text>
            </g>
          );
        })}

        {renderModel.walls.map(({ source: wall, start, end, midpoint, appearance }) => {
          const selected = wall.id === selectedWallId;
          return (
            <g key={wall.id} onPointerDown={onWallPointerDown(wall.id)} style={{ ...layerStyle("architecture"), cursor: tool === "select" ? (wall.locked ? "not-allowed" : "move") : tool === "wall" ? "crosshair" : "pointer" }}>
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="transparent" strokeWidth="14" />
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={selected ? "#2F78C4" : appearance.colour || (wall.locked ? "#5B6B78" : "#1B2B3A")}
                strokeWidth={Math.max(2.5, wall.thicknessInches)}
                strokeLinecap="square"
                strokeDasharray={appearance.dash}
                opacity={appearance.opacity}
                style={{ pointerEvents: "none" }}
              />
              {cad.layerSettings.dimensions.visible && (selected || tool === "wall") && (
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
            style={{ ...layerStyle("architecture"), pointerEvents: "none" }}
          />
        )}

        {renderModel.openings.map(({ source: opening, wall: resolvedWall, span, appearance }) => {
          const wall = resolvedWall.source;
          const normal = { x: -span.direction.y, y: span.direction.x };
          const selected = selectedOpeningIds.includes(opening.id);
          if (opening.type === "window") {
            return (
              <g key={opening.id} opacity={appearance.opacity} onPointerDown={onOpeningPointerDown(opening.id)} style={{ ...layerStyle("architecture"), cursor: "pointer" }}>
                <line x1={span.start.x} y1={span.start.y} x2={span.end.x} y2={span.end.y} stroke="#FBF8F1" strokeWidth={Math.max(8, wall.thicknessInches + 3)} />
                <line x1={span.start.x} y1={span.start.y} x2={span.end.x} y2={span.end.y} stroke={selected ? "#2F78C4" : "#5E86A8"} strokeWidth="3" />
                <line x1={span.start.x + normal.x * 4} y1={span.start.y + normal.y * 4} x2={span.end.x + normal.x * 4} y2={span.end.y + normal.y * 4} stroke="#5E86A8" strokeWidth="1" />
                {selected && <>
                  <circle cx={span.start.x} cy={span.start.y} r="5" fill="#FBF8F1" stroke="#2F78C4" strokeWidth="2" onPointerDown={onOpeningResizePointerDown(opening.id, "start")} style={{ cursor: "ew-resize" }} />
                  <circle cx={span.end.x} cy={span.end.y} r="5" fill="#FBF8F1" stroke="#2F78C4" strokeWidth="2" onPointerDown={onOpeningResizePointerDown(opening.id, "end")} style={{ cursor: "ew-resize" }} />
                  <text x={(span.start.x + span.end.x) / 2} y={(span.start.y + span.end.y) / 2 - 10} textAnchor="middle" fontSize="7" fill="#2F78C4" className="mono" style={{ pointerEvents: "none" }}>{lengthToDisplay(opening.widthInches, unit, unit === "imperial")}</text>
                </>}
              </g>
            );
          }
          const hinge = opening.hingeSide === "end" ? span.end : span.start;
          const closedEnd = opening.hingeSide === "end" ? span.start : span.end;
          const leafDirection = opening.hingeSide === "end" ? { x: -normal.x, y: -normal.y } : normal;
          const leafEnd = { x: hinge.x + leafDirection.x * span.width * opening.swing, y: hinge.y + leafDirection.y * span.width * opening.swing };
          const sweep = opening.swing > 0 ? 1 : 0;
          return (
            <g key={opening.id} opacity={appearance.opacity} onPointerDown={onOpeningPointerDown(opening.id)} style={{ ...layerStyle("architecture"), cursor: "pointer" }}>
              <line x1={span.start.x} y1={span.start.y} x2={span.end.x} y2={span.end.y} stroke="#FBF8F1" strokeWidth={Math.max(8, wall.thicknessInches + 3)} />
              <line x1={hinge.x} y1={hinge.y} x2={leafEnd.x} y2={leafEnd.y} stroke={selected ? "#2F78C4" : "#B8863E"} strokeWidth="2" />
              <path d={`M ${closedEnd.x} ${closedEnd.y} A ${span.width} ${span.width} 0 0 ${opening.hingeSide === "end" ? 1 - sweep : sweep} ${leafEnd.x} ${leafEnd.y}`} fill="none" stroke="#B8863E" strokeWidth="1" strokeDasharray="3 3" />
              {selected && <>
                <circle cx={span.start.x} cy={span.start.y} r="5" fill="#FBF8F1" stroke="#2F78C4" strokeWidth="2" onPointerDown={onOpeningResizePointerDown(opening.id, "start")} style={{ cursor: "ew-resize" }} />
                <circle cx={span.end.x} cy={span.end.y} r="5" fill="#FBF8F1" stroke="#2F78C4" strokeWidth="2" onPointerDown={onOpeningResizePointerDown(opening.id, "end")} style={{ cursor: "ew-resize" }} />
                <text x={(span.start.x + span.end.x) / 2} y={(span.start.y + span.end.y) / 2 - 10} textAnchor="middle" fontSize="7" fill="#2F78C4" className="mono" style={{ pointerEvents: "none" }}>{lengthToDisplay(opening.widthInches, unit, unit === "imperial")}</text>
              </>}
            </g>
          );
        })}

        {renderModel.electricalRoutes.map(({ source: route, points, circuit }) => {
          return <g key={route.id} style={{ ...layerStyle("electrical"), pointerEvents: "none" }}><polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={circuit?.colour || "#D26A3D"} strokeWidth="1.5" strokeDasharray="5 3" /><text x={points[1].x} y={points[1].y - 3} fontSize="6" fill={circuit?.colour || "#D26A3D"} className="mono">{circuit?.name || "WIRE"}</text></g>;
        })}

        {renderModel.plumbingRoutes.map(({ source: route, points, system }) => {
          return <g key={route.id} style={{ ...layerStyle("plumbing"), pointerEvents: "none" }}><polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={system.colour} strokeWidth={Math.max(1.5, route.diameterMm / 10)} strokeDasharray={system.dash || undefined} /><text x={points[1].x + 3} y={points[1].y - 3} fontSize="6" fill={system.colour} className="mono">{system.label} Ø{route.diameterMm}</text></g>;
        })}

        {renderModel.objects.map(({ source: object, preset, x, y, rotation, layer: objectLayer, appearance }) => {
          const selected = cad.selectedObjectIds.includes(object.id);
          const warning = cad.warningObjectIds.includes(object.id);
          if (object.mount === "wall") {
            const width = object.kind === "radiator" ? object.widthInches : 16;
            return (
              <g key={object.id} opacity={appearance.opacity} transform={`translate(${x} ${y}) rotate(${rotation})`} onPointerDown={onObjectPointerDown(object.id)} style={{ ...layerStyle(objectLayer), cursor: "pointer" }}>
                <rect x={-width / 2} y="-8" width={width} height="16" rx="2" fill="#FBF8F1" stroke={selected ? "#2F78C4" : object.category === "Electrical" ? "#D26A3D" : "#8A6D4B"} strokeWidth={selected ? 2 : 1.5} />
                <text x="0" y="2.5" textAnchor="middle" fontSize="6" fontWeight="600" fill="#1B2B3A" className="mono">{preset.symbol}</text>
              </g>
            );
          }
          if (object.mount === "floor") {
            return (
              <g key={object.id} opacity={appearance.opacity} transform={`translate(${x} ${y}) rotate(${rotation})`} onPointerDown={onObjectPointerDown(object.id)} style={{ ...layerStyle(objectLayer), cursor: "move" }}>
                {(selected || warning) && <rect x={-object.widthInches / 2 - 3} y={-object.depthInches / 2 - 3} width={object.widthInches + 6} height={object.depthInches + 6} fill="none" stroke={warning ? "#B2483A" : "#2F78C4"} strokeWidth="2" strokeDasharray="4 3" />}
                <rect x={-object.widthInches / 2} y={-object.depthInches / 2} width={object.widthInches} height={object.depthInches} rx="3" fill={warning ? "#E8B7AE" : "#D7C7A7"} fillOpacity="0.82" stroke={warning ? "#B2483A" : "#7A6F5C"} strokeWidth="1.5" />
                <text x="0" y="2.5" textAnchor="middle" fontSize="7" fill="#1B2B3A" className="mono" style={{ pointerEvents: "none" }}>{object.name}</text>
              </g>
            );
          }
          return (
            <g key={object.id} opacity={appearance.opacity} transform={`translate(${x} ${y})`} onPointerDown={onObjectPointerDown(object.id)} style={{ ...layerStyle(objectLayer), cursor: "move" }}>
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
                style={{ ...layerStyle("architecture"), cursor: locked && tool !== "wall" ? "not-allowed" : tool === "wall" ? "crosshair" : "move" }}
              />
            );
          })}
      </svg>

      <div className="pointer-events-none absolute left-1/2 top-3 hidden -translate-x-1/2 rounded-md border border-[#D8CCB0] bg-[#FBF8F1]/95 px-3 py-1.5 text-center text-[10px] text-[#5B6B78] shadow-sm sm:block">
        {tool === "wall" && (activeNodeId == null ? "Wall tool · click an anchor to begin" : "Drawing wall · click to place, or enter an exact length")}
        {tool === "select" && (selectedOpeningId != null ? `${selectedOpeningIds.length} opening${selectedOpeningIds.length === 1 ? "" : "s"} selected · drag to move, handles resize, Shift-click adds` : selectedWallId != null ? "Wall selected · edit its exact dimensions in the panel" : selectedRoomId != null ? "Space selected · name it or mark it as a room or void" : "Select tool · click an item or enclosed space to edit it")}
        {(tool === "door" || tool === "window") && `Place ${tool} · click a wall`}
        {tool === "object" && "Placement tool · click the drawing or a host wall"}
      </div>

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
