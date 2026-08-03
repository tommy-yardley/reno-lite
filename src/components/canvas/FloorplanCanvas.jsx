import React from "react";
import {
  dist,
  centroidOf,
  wallSpan,
  doorGeometry,
  furnitureRectPx,
} from "../../lib/geometry";
import { lengthToDisplay } from "../../lib/units";
import {
  VOID_COLOR,
  WINDOW_COLOR,
  DOOR_COLOR,
  SELECTION_COLOR,
} from "../../constants";
import { CATEGORY_COLORS } from "../../lib/furnitureEngine";

export default function Canvas({ fp }) {
  const {
    image,
    scale,
    unit,
    imperialFraction,
    mode,
    svgRef,
    handleSvgClick,
    onSvgMouseMove,
    onSvgMouseUp,
    gridLines,
    rooms,
    voids,
    overlappingRoomIds,
    escapedVoidIds,
    vertexMap,
    wallSegments,
    getWallProps,
    selectedWallKey,
    onWallPointerDown,
    windows,
    doors,
    selectedWindowId,
    selectedDoorId,
    onWindowMouseDown,
    onDoorMouseDown,
    furniture,
    furnitureWarnings,
    selectedFurnitureId,
    onFurnitureMouseDown,
    currentChain,
    previewPoint,
    vertices,
    draggingVertexId, // eslint-disable-line no-unused-vars
    selectedVertexId,
    onVertexMouseDown,
    calibrationLine,
    calPoints,
    mousePos,
    scaleBar,
    northAngle,
    setNorthAngle,
  } = fp;

  if (!image) {
    const steps = [
      { n: 1, title: "Upload a photo", desc: "A phone photo of your floor plan, blueprint, or even a hand sketch all work." },
      { n: 2, title: "Calibrate the scale", desc: "Draw a line over one wall and tell it the real length — everything else is measured from that." },
      { n: 3, title: "Trace the rooms", desc: "Click corners to draw each room. Snap onto an existing corner and that wall becomes shared between rooms." },
    ];
    return (
      <div className="min-h-[400px] flex items-center justify-center rounded-lg border border-dashed p-8" style={{ borderColor: "#D8CCB0" }}>
        <div className="max-w-sm w-full">
          <p className="text-sm font-semibold mb-4 serif" style={{ color: "#1B2B3A" }}>Get started in three steps</p>
          <div className="space-y-4">
            {steps.map((step) => (
              <div key={step.n} className="flex gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mono" style={{ background: "#B8863E", color: "#FBF8F1" }}>
                  {step.n}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "#1B2B3A" }}>{step.title}</p>
                  <p className="text-xs" style={{ color: "#5B6B78" }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#D8CCB0] p-2 inline-block" style={{ background: "#FBF8F1" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${image.w} ${image.h}`}
        width="100%"
        style={{
          maxWidth: 900,
          display: "block",
          touchAction: "none",
          cursor: ["drawing", "calibrating", "placingWindow", "placingDoor"].includes(mode) ? "crosshair" : "default",
        }}
        onClick={handleSvgClick}
        onPointerMove={onSvgMouseMove}
        onPointerUp={onSvgMouseUp}
        onPointerCancel={onSvgMouseUp}
      >
        <defs>
          <pattern id="voidHatch" width="9" height="9" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="9" height="9" fill={VOID_COLOR} fillOpacity="0.35" />
            <line x1="0" y1="0" x2="0" y2="9" stroke={VOID_COLOR} strokeWidth="3" />
          </pattern>
        </defs>

        <image href={image.src} x="0" y="0" width={image.w} height={image.h} opacity="0.55" />

        {gridLines.map((l, i) =>
          l.type === "v" ? (
            <line key={i} x1={l.pos} y1={0} x2={l.pos} y2={image.h} stroke="#1B2B3A" strokeOpacity="0.08" strokeWidth="1" />
          ) : (
            <line key={i} x1={0} y1={l.pos} x2={image.w} y2={l.pos} stroke="#1B2B3A" strokeOpacity="0.08" strokeWidth="1" />
          )
        )}

        {/* finished rooms */}
        {rooms.map((room) => {
          const pts = room.vertexIds.map((id) => vertexMap.get(id)).filter(Boolean);
          if (pts.length < 3) return null;
          const c = centroidOf(pts);
          const overlapping = overlappingRoomIds.has(room.id);
          return (
            <g key={room.id}>
              <polygon
                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={room.color}
                fillOpacity="0.22"
                stroke={overlapping ? "#E0554A" : "none"}
                strokeWidth={overlapping ? 2.5 : 0}
                strokeDasharray={overlapping ? "6 4" : "0"}
              />
              <text x={c.x} y={c.y - 6} fill="#1B2B3A" fontSize="13" fontWeight="600" fontFamily="'Zilla Slab', serif" textAnchor="middle" style={{ paintOrder: "stroke", stroke: "#FBF8F1", strokeWidth: 4 }}>
                {room.name}
              </text>
              <text x={c.x} y={c.y + 10} fill="#5B6B78" fontSize="10" textAnchor="middle" className="mono" style={{ paintOrder: "stroke", stroke: "#FBF8F1", strokeWidth: 4 }}>
                {room.type}
              </text>
            </g>
          );
        })}

        {/* blocked-in voids */}
        {voids.map((v) => {
          const pts = v.vertexIds.map((id) => vertexMap.get(id)).filter(Boolean);
          if (pts.length < 3) return null;
          const c = centroidOf(pts);
          const escaped = escapedVoidIds.has(v.id);
          return (
            <g key={v.id}>
              <polygon
                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="url(#voidHatch)"
                stroke={escaped ? "#E0954A" : VOID_COLOR}
                strokeWidth={escaped ? 2.5 : 1.5}
                strokeDasharray={escaped ? "6 4" : "0"}
              />
              <text x={c.x} y={c.y} fill="#1B2B3A" fontSize="10" textAnchor="middle" className="mono" style={{ paintOrder: "stroke", stroke: "#FBF8F1", strokeWidth: 3 }}>
                {v.name}
              </text>
            </g>
          );
        })}

        {/* walls */}
        {wallSegments.map((w) => {
          const mx = (w.a.x + w.b.x) / 2;
          const my = (w.a.y + w.b.y) / 2;
          const lenInches = scale ? dist(w.a, w.b) * scale : 0;
          const selected = selectedWallKey === w.key;
          const props = getWallProps(w.key);
          const thicknessPx = scale ? Math.max(1.5, props.thickness / scale) : 3;
          return (
            <g key={w.key}>
              <line
                x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y}
                stroke="transparent" strokeWidth="18"
                style={{ cursor: mode === "idle" ? "pointer" : "default" }}
                onPointerDown={onWallPointerDown(w.key)}
              />
              <line
                x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y}
                stroke={selected ? SELECTION_COLOR : "#1B2B3A"}
                strokeWidth={props.open ? (selected ? 3 : 1.5) : selected ? thicknessPx + 2 : thicknessPx}
                strokeDasharray={props.open ? "5 4" : "0"}
                strokeOpacity={props.open ? 0.7 : 1}
                style={{ pointerEvents: "none" }}
              />
              <text x={mx} y={my - thicknessPx / 2 - 5} fill="#B8863E" fontSize="13" textAnchor="middle" className="mono" style={{ paintOrder: "stroke", stroke: "#FBF8F1", strokeWidth: 3, pointerEvents: "none" }}>
                {lengthToDisplay(lenInches, unit, unit === "imperial" && imperialFraction)}
              </text>
            </g>
          );
        })}

        {/* windows */}
        {windows.map((w) => {
          const wall = wallSegments.find((ws) => ws.key === w.wallKey);
          if (!wall) return null;
          const span = wallSpan(wall.a, wall.b, w.t, w.widthInches, scale);
          const perp = { x: -span.dir.y, y: span.dir.x };
          const tick = 7;
          const selected = selectedWindowId === w.id;
          return (
            <g key={w.id} onPointerDown={onWindowMouseDown(w.id)} style={{ cursor: mode === "idle" ? "grab" : "default" }}>
              <line x1={span.start.x} y1={span.start.y} x2={span.end.x} y2={span.end.y} stroke={WINDOW_COLOR} strokeWidth={selected ? 7 : 5} />
              <line x1={span.start.x - perp.x * tick} y1={span.start.y - perp.y * tick} x2={span.start.x + perp.x * tick} y2={span.start.y + perp.y * tick} stroke={WINDOW_COLOR} strokeWidth="2" />
              <line x1={span.end.x - perp.x * tick} y1={span.end.y - perp.y * tick} x2={span.end.x + perp.x * tick} y2={span.end.y + perp.y * tick} stroke={WINDOW_COLOR} strokeWidth="2" />
              {selected && <circle cx={span.center.x} cy={span.center.y} r="8" fill="none" stroke={SELECTION_COLOR} strokeWidth="2" strokeDasharray="3 2" />}
            </g>
          );
        })}

        {/* doors */}
        {doors.map((d) => {
          const wall = wallSegments.find((ws) => ws.key === d.wallKey);
          if (!wall) return null;
          const geom = doorGeometry(wall.a, wall.b, d.t, d.widthInches, d.hinge, d.swingSide, scale);
          const perp = { x: -geom.dir.y, y: geom.dir.x };
          const tick = 7;
          const selected = selectedDoorId === d.id;
          return (
            <g key={d.id} onPointerDown={onDoorMouseDown(d.id)} style={{ cursor: mode === "idle" ? "grab" : "default" }}>
              <line x1={geom.start.x} y1={geom.start.y} x2={geom.end.x} y2={geom.end.y} stroke="transparent" strokeWidth="16" />
              <line x1={geom.start.x - perp.x * tick} y1={geom.start.y - perp.y * tick} x2={geom.start.x + perp.x * tick} y2={geom.start.y + perp.y * tick} stroke={DOOR_COLOR} strokeWidth="2" />
              <line x1={geom.end.x - perp.x * tick} y1={geom.end.y - perp.y * tick} x2={geom.end.x + perp.x * tick} y2={geom.end.y + perp.y * tick} stroke={DOOR_COLOR} strokeWidth="2" />
              <path
                d={`M ${geom.O.x} ${geom.O.y} A ${geom.widthPx} ${geom.widthPx} 0 0 ${geom.sweepFlag} ${geom.leafOpenEnd.x} ${geom.leafOpenEnd.y}`}
                fill="none" stroke={DOOR_COLOR} strokeWidth={selected ? 2 : 1.3} strokeDasharray="3 3"
              />
              <line x1={geom.H.x} y1={geom.H.y} x2={geom.leafOpenEnd.x} y2={geom.leafOpenEnd.y} stroke={DOOR_COLOR} strokeWidth={selected ? 3 : 2} />
              {selected && <circle cx={geom.center.x} cy={geom.center.y} r="8" fill="none" stroke={SELECTION_COLOR} strokeWidth="2" strokeDasharray="3 2" />}
            </g>
          );
        })}

        {/* furniture */}
        {scale &&
          furniture.map((it) => {
            const rect = furnitureRectPx(it, scale);
            const warn = furnitureWarnings.has(it.id);
            const selected = selectedFurnitureId === it.id;
            const color = CATEGORY_COLORS[it.category] || CATEGORY_COLORS.Other;
            return (
              <g key={it.id} onPointerDown={onFurnitureMouseDown(it.id)} style={{ cursor: mode === "idle" ? "grab" : "default" }}>
                {selected && !warn && (
                  <rect x={rect.x - 3} y={rect.y - 3} width={rect.w + 6} height={rect.h + 6} rx="5" fill="none" stroke={SELECTION_COLOR} strokeWidth="2" strokeDasharray="3 2" />
                )}
                <rect
                  x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx="3"
                  fill={color} fillOpacity="0.8"
                  stroke={warn ? "#E0554A" : "#FBF8F1"}
                  strokeWidth={warn ? 2.5 : 1.3}
                />
                <text x={it.x} y={it.y} fill="#1B2B3A" fontSize="9" fontWeight="600" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: "none" }}>
                  {it.name}
                </text>
              </g>
            );
          })}

        {/* in-progress trace chain */}
        {currentChain.length > 0 && (
          <polyline
            points={currentChain
              .map((id) => vertexMap.get(id))
              .filter(Boolean)
              .concat(previewPoint && mode === "drawing" ? [previewPoint] : [])
              .map((p) => `${p.x},${p.y}`)
              .join(" ")}
            fill="none" stroke="#B8863E" strokeWidth="2.5" strokeDasharray="6 4"
          />
        )}

        {/* vertices */}
        {vertices.map((v) => (
          <g key={v.id}>
            {selectedVertexId === v.id && <circle cx={v.x} cy={v.y} r={11} fill="none" stroke={SELECTION_COLOR} strokeWidth="2" strokeDasharray="3 2" />}
            <circle
              cx={v.x} cy={v.y} r={6}
              fill={currentChain[0] === v.id && mode === "drawing" ? "#6FA98C" : "#B8863E"}
              stroke="#1B2B3A" strokeWidth="1.5"
              style={{ cursor: mode === "idle" ? "move" : "pointer" }}
              onPointerDown={onVertexMouseDown(v.id)}
            />
          </g>
        ))}

        {/* calibration */}
        {calibrationLine && (
          <line x1={calibrationLine.p1.x} y1={calibrationLine.p1.y} x2={calibrationLine.p2.x} y2={calibrationLine.p2.y} stroke="#6FA98C" strokeWidth="2" strokeDasharray="4 3" />
        )}
        {mode === "calibrating" && calPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={6} fill="#6FA98C" stroke="#1B2B3A" strokeWidth="1.5" />)}
        {mode === "calibrating" && calPoints.length === 1 && mousePos && (
          <line x1={calPoints[0].x} y1={calPoints[0].y} x2={mousePos.x} y2={mousePos.y} stroke="#6FA98C" strokeWidth="2" strokeDasharray="4 3" />
        )}

        {/* scale bar */}
        {scaleBar && (
          <g transform={`translate(20, ${image.h - 26})`}>
            <rect x={0} y={0} width={scaleBar.px / 2} height={5} fill="#1B2B3A" />
            <rect x={scaleBar.px / 2} y={0} width={scaleBar.px / 2} height={5} fill="#FBF8F1" stroke="#1B2B3A" strokeWidth="1" />
            <rect x={0} y={0} width={scaleBar.px} height={5} fill="none" stroke="#1B2B3A" strokeWidth="1" />
            <text x={scaleBar.px / 2} y={-6} fill="#1B2B3A" fontSize="11" textAnchor="middle" className="mono" style={{ paintOrder: "stroke", stroke: "#FBF8F1", strokeWidth: 3 }}>
              {scaleBar.label}
            </text>
          </g>
        )}

        {/* north arrow */}
        {scale && (
          <g
            transform={`translate(${image.w - 34}, 34) rotate(${northAngle})`}
            onPointerDown={(e) => {
              e.stopPropagation();
              setNorthAngle((a) => (a + 90) % 360);
            }}
            style={{ cursor: "pointer" }}
          >
            <circle cx={0} cy={0} r={22} fill="none" stroke="#5E86A8" strokeWidth="1" strokeDasharray="2 3" strokeOpacity="0.6" />
            <circle cx={0} cy={0} r={18} fill="#FBF8F1" fillOpacity="0.85" stroke="#5E86A8" strokeWidth="1.5" />
            <path d="M 0 -12 L 5 6 L 0 2 L -5 6 Z" fill="#B8863E" />
            <text x={0} y={26} fill="#5E86A8" fontSize="9" textAnchor="middle" className="mono" transform={`rotate(${-northAngle})`}>
              N
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
