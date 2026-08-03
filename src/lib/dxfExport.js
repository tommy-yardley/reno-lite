import { dist, centroidOf, wallSpan, wallRectCorners, furnitureRectPx, rectCorners } from "./geometry";
import { INCH_PER_METER, DEFAULT_WALL_THICKNESS_IN } from "../constants";

function dxfEsc(str) {
  return String(str).replace(/[\r\n]/g, " ");
}

// Writes a minimal ASCII DXF (R12-style group codes) containing:
//  - walls as closed 4-point LWPOLYLINE rectangles (real thickness, both faces),
//    or a single centerline LINE for edges marked "open" (no real wall)
//  - doors/windows as centerline LINEs on their own layers
//  - furniture as closed rectangles + name labels
//  - room name labels
// Coordinates are converted to real-world feet or meters and Y is flipped
// (image coordinates increase downward; CAD convention is Y-up).
export function buildDxf({ wallSegments, wallProps, doors, windows, rooms, furniture, vertexMap, scale, unit }) {
  const toUnit = (inches) => (unit === "imperial" ? inches / 12 : inches / INCH_PER_METER);
  const X = (px) => toUnit(px * scale).toFixed(4);
  const Y = (px) => (-toUnit(px * scale)).toFixed(4);
  const lines = [];
  const line = (code, value) => {
    lines.push(String(code));
    lines.push(String(value));
  };

  line(0, "SECTION");
  line(2, "ENTITIES");

  wallSegments.forEach((w) => {
    const props = wallProps[w.key] || { thickness: DEFAULT_WALL_THICKNESS_IN, open: false };
    if (props.open) {
      line(0, "LINE");
      line(8, "OPEN_BOUNDARY");
      line(10, X(w.a.x));
      line(20, Y(w.a.y));
      line(30, 0);
      line(11, X(w.b.x));
      line(21, Y(w.b.y));
      line(31, 0);
      return;
    }
    const thicknessPx = props.thickness / scale;
    const corners = wallRectCorners(w.a, w.b, thicknessPx);
    line(0, "LWPOLYLINE");
    line(8, "WALLS");
    line(90, 4);
    line(70, 1);
    corners.forEach((c) => {
      line(10, X(c.x));
      line(20, Y(c.y));
    });
  });

  doors.forEach((d) => {
    const wall = wallSegments.find((w) => w.key === d.wallKey);
    if (!wall) return;
    const span = wallSpan(wall.a, wall.b, d.t, d.widthInches, scale);
    line(0, "LINE");
    line(8, "DOORS");
    line(10, X(span.start.x));
    line(20, Y(span.start.y));
    line(30, 0);
    line(11, X(span.end.x));
    line(21, Y(span.end.y));
    line(31, 0);
  });

  windows.forEach((wi) => {
    const wall = wallSegments.find((w) => w.key === wi.wallKey);
    if (!wall) return;
    const span = wallSpan(wall.a, wall.b, wi.t, wi.widthInches, scale);
    line(0, "LINE");
    line(8, "WINDOWS");
    line(10, X(span.start.x));
    line(20, Y(span.start.y));
    line(30, 0);
    line(11, X(span.end.x));
    line(21, Y(span.end.y));
    line(31, 0);
  });

  (furniture || []).forEach((it) => {
    const rect = furnitureRectPx(it, scale);
    const corners = rectCorners(rect);
    line(0, "LWPOLYLINE");
    line(8, "FURNITURE");
    line(90, 4);
    line(70, 1);
    corners.forEach((c) => {
      line(10, X(c.x));
      line(20, Y(c.y));
    });
    line(0, "TEXT");
    line(8, "FURNITURE_LABELS");
    line(10, X(it.x));
    line(20, Y(it.y));
    line(30, 0);
    line(40, 5);
    line(1, dxfEsc(it.name));
  });

  rooms.forEach((room) => {
    const pts = room.vertexIds.map((id) => vertexMap.get(id)).filter(Boolean);
    if (pts.length < 3) return;
    const c = centroidOf(pts);
    line(0, "TEXT");
    line(8, "ROOM_LABELS");
    line(10, X(c.x));
    line(20, Y(c.y));
    line(30, 0);
    line(40, 8);
    line(1, dxfEsc(room.name));
  });

  line(0, "ENDSEC");
  line(0, "EOF");
  return lines.join("\n");
}
