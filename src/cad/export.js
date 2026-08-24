import { buildRenderModel } from "./renderModel.js";
export { parseProject, serializeProject } from "./project.js";

const xmlEscape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[
        character
      ],
  );
const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function buildCadSvg(project) {
  const model = buildRenderModel(project);
  const roomMarkup = model.rooms
    .map(({ source: room, points, center, area }) =>
      `<g data-entity="room" data-id="${room.id}"><polygon points="${points.map((point) => `${point.x},${point.y}`).join(" ")}" fill="${room.classification === "void" ? "#a8a8a2" : room.color || "#dcebdc"}" fill-opacity="${room.classification === "void" ? "0.5" : "0.28"}" ${room.classification === "void" ? 'stroke="#777" stroke-dasharray="5 3"' : ""}/><text x="${center.x}" y="${center.y}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#1b2b3a">${xmlEscape(room.classification === "void" ? `${room.name} · VOID` : room.name)}</text><text x="${center.x}" y="${center.y + 12}" text-anchor="middle" font-family="monospace" font-size="7" fill="#5b6b78">${(area / 39.3700787 ** 2).toFixed(1)} m²</text></g>`,
    )
    .join("");
  const wallMarkup = model.walls
    .map(
      ({ source: wall, start, end, appearance }) =>
        `<line data-entity="wall" data-id="${wall.id}" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${appearance.colour || "#17242f"}" stroke-width="${wall.thicknessInches}" stroke-linecap="square" opacity="${appearance.opacity}" ${appearance.dash ? `stroke-dasharray="${appearance.dash}"` : ""}/>`,
    )
    .join("");
  const openingMarkup = model.openings
    .map(({ source: opening, wall, span, appearance }) => {
      const color = appearance.colour || (opening.type === "door" ? "#b8863e" : "#5e86a8");
      return `<g data-entity="${opening.type}" data-id="${opening.id}" opacity="${appearance.opacity}"><line x1="${span.start.x}" y1="${span.start.y}" x2="${span.end.x}" y2="${span.end.y}" stroke="#fff" stroke-width="${Math.max(8, wall.source.thicknessInches + 3)}"/><line x1="${span.start.x}" y1="${span.start.y}" x2="${span.end.x}" y2="${span.end.y}" stroke="${color}" stroke-width="2" ${appearance.dash ? `stroke-dasharray="${appearance.dash}"` : ""}/></g>`;
    })
    .join("");
  const objectMarkup = model.objects
    .map(({ source: object, preset, x, y, rotation, layer }) => {
      if (object.mount === "wall") {
        return `<g data-entity="object" data-id="${object.id}" data-layer="${layer}" transform="translate(${x} ${y}) rotate(${rotation})"><rect x="-8" y="-7" width="16" height="14" rx="2" fill="#fff" stroke="#d26a3d"/><text x="0" y="2" text-anchor="middle" font-family="monospace" font-size="5">${xmlEscape(preset.symbol)}</text></g>`;
      }
      if (object.mount === "floor") {
        return `<g data-entity="object" data-id="${object.id}" data-layer="${layer}" transform="translate(${x} ${y}) rotate(${rotation})"><rect x="${-object.widthInches / 2}" y="${-object.depthInches / 2}" width="${object.widthInches}" height="${object.depthInches}" rx="2" fill="#d7c7a7" stroke="#7a6f5c"/><text x="0" y="2" text-anchor="middle" font-family="sans-serif" font-size="7">${xmlEscape(object.name)}</text></g>`;
      }
      return `<g data-entity="object" data-id="${object.id}" data-layer="${layer}" transform="translate(${x} ${y})"><circle r="9" fill="#fff" stroke="#d4a72c"/><path d="M-6 0H6M0-6V6" stroke="#d4a72c"/><text x="0" y="2" text-anchor="middle" font-family="monospace" font-size="5">${xmlEscape(preset.symbol)}</text></g>`;
    })
    .join("");
  const electricalMarkup = model.electricalRoutes
    .map(
      ({ source: route, points, circuit }) =>
        `<polyline data-entity="electrical-route" data-id="${route.id}" points="${points.map((point) => `${point.x},${point.y}`).join(" ")}" fill="none" stroke="${circuit?.colour || "#d26a3d"}" stroke-width="1.5" stroke-dasharray="5 3"/>`,
    )
    .join("");
  const plumbingMarkup = model.plumbingRoutes
    .map(
      ({ source: route, points, system }) =>
        `<polyline data-entity="plumbing-route" data-id="${route.id}" points="${points.map((point) => `${point.x},${point.y}`).join(" ")}" fill="none" stroke="${system.colour}" stroke-width="${Math.max(1.5, route.diameterMm / 10)}" ${system.dash ? `stroke-dasharray="${system.dash}"` : ""}/>`,
    )
    .join("");
  const { minX, minY, width, height } = model.bounds;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}"><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#fff"/>${roomMarkup}${wallMarkup}${openingMarkup}${electricalMarkup}${plumbingMarkup}${objectMarkup}</svg>`;
}

const dxfPair = (code, value) => `${code}\n${value}\n`;

export function buildCadDxf(project) {
  const model = buildRenderModel(project);
  let output =
    dxfPair(0, "SECTION") +
    dxfPair(2, "HEADER") +
    dxfPair(9, "$INSUNITS") +
    dxfPair(70, 1) +
    dxfPair(0, "ENDSEC") +
    dxfPair(0, "SECTION") +
    dxfPair(2, "ENTITIES");
  for (const { source: room, points } of model.rooms) {
    output +=
      dxfPair(0, "LWPOLYLINE") +
      dxfPair(8, room.classification === "void" ? "VOIDS" : "ROOMS") +
      dxfPair(90, points.length) +
      dxfPair(70, 1);
    for (const point of points) output += dxfPair(10, point.x) + dxfPair(20, -point.y);
  }
  for (const { source: wall, start, end, midpoint, length } of model.walls) {
    output +=
      dxfPair(0, "LINE") +
      dxfPair(8, wall.locked ? "WALLS_LOCKED" : "WALLS") +
      dxfPair(10, start.x) +
      dxfPair(20, -start.y) +
      dxfPair(11, end.x) +
      dxfPair(21, -end.y);
    output +=
      dxfPair(0, "TEXT") +
      dxfPair(8, "DIMENSIONS") +
      dxfPair(10, midpoint.x) +
      dxfPair(20, -midpoint.y) +
      dxfPair(40, 5) +
      dxfPair(1, `${length.toFixed(2)} in`);
  }
  for (const { source: opening, span } of model.openings) {
    output +=
      dxfPair(0, "LINE") +
      dxfPair(8, opening.type === "door" ? "DOORS" : "WINDOWS") +
      dxfPair(10, span.start.x) +
      dxfPair(20, -span.start.y) +
      dxfPair(11, span.end.x) +
      dxfPair(21, -span.end.y);
  }
  for (const { source: object, x, y } of model.objects) {
    output +=
      dxfPair(0, "TEXT") +
      dxfPair(8, (object.category || "OBJECTS").toUpperCase()) +
      dxfPair(10, x) +
      dxfPair(20, -y) +
      dxfPair(40, 6) +
      dxfPair(1, object.name);
  }
  for (const { points } of model.electricalRoutes) {
    output += dxfPair(0, "LWPOLYLINE") + dxfPair(8, "ELECTRICAL_WIRING") + dxfPair(90, points.length) + dxfPair(70, 0);
    for (const point of points) output += dxfPair(10, point.x) + dxfPair(20, -point.y);
  }
  for (const { source: route, points } of model.plumbingRoutes) {
    output += dxfPair(0, "LWPOLYLINE") + dxfPair(8, `PLUMBING_${route.system.toUpperCase()}`) + dxfPair(90, points.length) + dxfPair(70, 0);
    for (const point of points) output += dxfPair(10, point.x) + dxfPair(20, -point.y);
  }
  return output + dxfPair(0, "ENDSEC") + dxfPair(0, "EOF");
}

export function contractorScheduleRows(project) {
  const model = buildRenderModel(project, { respectVisibility: false });
  return [
    ...model.rooms.map(({ source: room, area }) => ({
      schedule: room.classification === "void" ? "Voids" : "Rooms",
      ref: `R${room.id}`,
      item: room.name,
      type: room.type || room.classification,
      size: `${(area / 39.3700787 ** 2).toFixed(2)} m²`,
      notes: room.classification === "void" ? "Excluded area" : "",
    })),
    ...model.walls.map(({ source: wall, length }) => ({
      schedule: "Walls",
      ref: `W${wall.id}`,
      item: wall.locked ? "Verified wall" : "Wall",
      type: wall.locked ? "Locked" : "Unverified",
      size: `${(length * 25.4).toFixed(0)} × ${(wall.thicknessInches * 25.4).toFixed(0)} mm`,
      notes: "",
    })),
    ...model.openings.map(({ source: opening }) => ({
      schedule: opening.type === "door" ? "Doors" : "Windows",
      ref: `${opening.type === "door" ? "D" : "WIN"}${opening.id}`,
      item: opening.variant || opening.type,
      type: opening.type,
      size: `${(opening.widthInches * 25.4).toFixed(0)} mm`,
      notes: opening.type === "door" ? `Hinge ${opening.hingeSide || "start"}` : "",
    })),
    ...(project.electricalCircuits || []).map((circuit) => ({
      schedule: "Electrical",
      ref: `C${circuit.id}`,
      item: circuit.name,
      type: circuit.kind || "Circuit",
      size: `${circuit.ratingAmps || 0} A`,
      notes: "Concept layout — electrician review required",
    })),
    ...model.plumbingRoutes.map(({ source: route, system }) => ({
      schedule: "Plumbing",
      ref: `P${route.id}`,
      item: system.label,
      type: route.system,
      size: `Ø${route.diameterMm} mm`,
      notes: "Concept layout — plumber review required",
    })),
  ];
}

export function buildContractorScheduleCsv(project) {
  const rows = contractorScheduleRows(project);
  return [
    "Schedule,Reference,Item,Type,Size,Notes",
    ...rows.map((row) => [row.schedule, row.ref, row.item, row.type, row.size, row.notes].map(csvEscape).join(",")),
  ].join("\n");
}

export function buildContractorScheduleSvg(project) {
  const rows = contractorScheduleRows(project);
  const width = 1000;
  const rowHeight = 28;
  const height = Math.max(180, 112 + rows.length * rowHeight);
  const markup = rows
    .map(
      (row, index) =>
        `<g transform="translate(0 ${78 + index * rowHeight})"><rect width="${width}" height="${rowHeight}" fill="${index % 2 ? "#f5f1e8" : "#fff"}"/><text x="18" y="19">${xmlEscape(row.schedule)}</text><text x="150" y="19">${xmlEscape(row.ref)}</text><text x="235" y="19">${xmlEscape(row.item)}</text><text x="500" y="19">${xmlEscape(row.type)}</text><text x="670" y="19">${xmlEscape(row.size)}</text><text x="790" y="19">${xmlEscape(row.notes)}</text></g>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><style>text{font-family:Arial,sans-serif;font-size:12px;fill:#1b2b3a}</style><text x="18" y="30" font-size="22" font-weight="bold">${xmlEscape(project.name || "RenoLite")} — contractor schedules</text><text x="18" y="62" font-weight="bold">Schedule</text><text x="150" y="62">Ref</text><text x="235" y="62">Item</text><text x="500" y="62">Type</text><text x="670" y="62">Size</text><text x="790" y="62">Notes</text>${markup}</svg>`;
}
