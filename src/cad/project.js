export const PROJECT_FORMAT = "reno-lite";
export const PROJECT_VERSION = 4;
export const PROJECT_STORAGE_KEY = "reno-lite:cad-v2";

export const PROJECT_COLLECTIONS = [
  "nodes",
  "walls",
  "rooms",
  "openings",
  "objects",
  "electricalCircuits",
  "electricalRoutes",
  "plumbingRoutes",
  "shoppingItems",
];

export const DEFAULT_LAYERS = Object.freeze(
  Object.fromEntries(
    ["architecture", "furniture", "electrical", "plumbing", "dimensions", "annotations", "reference"].map((key) => [
      key,
      Object.freeze({ visible: true, locked: false }),
    ]),
  ),
);

const cloneLayers = (layers = {}) =>
  Object.fromEntries(
    Object.entries(DEFAULT_LAYERS).map(([key, defaults]) => [
      key,
      { ...defaults, ...(layers[key] || {}) },
    ]),
  );

export function createEmptyProject(overrides = {}) {
  const project = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    projectId: null,
    name: "Untitled renovation",
    renovationView: "existing",
    nodes: [],
    walls: [],
    rooms: [],
    openings: [],
    objects: [],
    electricalCircuits: [],
    electricalRoutes: [],
    plumbingRoutes: [],
    shoppingItems: [],
    unit: "metric",
    referenceImage: null,
    layerSettings: cloneLayers(),
    ...overrides,
  };
  return {
    ...project,
    walls: project.walls.map((wall) => ({ renovationStatus: "existing", ...wall })),
    openings: project.openings.map((opening) => ({ renovationStatus: "existing", ...opening })),
    objects: project.objects.map((object) => ({ renovationStatus: "proposed", ...object })),
    electricalRoutes: project.electricalRoutes.map((route) => ({ renovationStatus: "proposed", ...route })),
    plumbingRoutes: project.plumbingRoutes.map((route) => ({ renovationStatus: "proposed", ...route })),
  };
}

function migrateProject(input) {
  const version = Number(input.version || 2);
  if (version > PROJECT_VERSION) {
    throw new Error(
      `This project uses RenoLite format v${version}; this app supports up to v${PROJECT_VERSION}.`,
    );
  }
  if (input.format && input.format !== PROJECT_FORMAT) {
    throw new Error("Not a RenoLite project file.");
  }

  const migrated = { ...input };
  if (version <= 2) {
    migrated.electricalCircuits ||= [];
    migrated.electricalRoutes ||= [];
    migrated.plumbingRoutes ||= [];
    migrated.shoppingItems ||= [];
  }
  if (version <= 3) migrated.name ||= "Imported renovation";
  return migrated;
}

function assertArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`Project field "${label}" must be a list.`);
}

function assertUniqueIds(project) {
  const seen = new Map();
  for (const collection of PROJECT_COLLECTIONS) {
    for (const entity of project[collection]) {
      if (entity == null || !Number.isSafeInteger(entity.id) || entity.id < 1) {
        throw new Error(`Every ${collection} item must have a positive integer id.`);
      }
      if (seen.has(entity.id)) {
        throw new Error(
          `Duplicate project id ${entity.id} in ${seen.get(entity.id)} and ${collection}.`,
        );
      }
      seen.set(entity.id, collection);
    }
  }
}

function assertReferences(project) {
  const nodeIds = new Set(project.nodes.map(({ id }) => id));
  const wallIds = new Set(project.walls.map(({ id }) => id));
  const roomIds = new Set(project.rooms.map(({ id }) => id));
  const objectIds = new Set(project.objects.map(({ id }) => id));
  const circuitIds = new Set(project.electricalCircuits.map(({ id }) => id));

  for (const wall of project.walls) {
    if (!nodeIds.has(wall.startNodeId) || !nodeIds.has(wall.endNodeId)) {
      throw new Error(`Wall ${wall.id} references a missing node.`);
    }
  }
  for (const room of project.rooms) {
    if (!room.nodeIds?.every((id) => nodeIds.has(id)) || !room.wallIds?.every((id) => wallIds.has(id))) {
      throw new Error(`Room ${room.id} references missing geometry.`);
    }
    if (room.hostRoomId != null && !roomIds.has(room.hostRoomId)) {
      throw new Error(`Room ${room.id} references a missing host room.`);
    }
  }
  for (const opening of project.openings) {
    if (!wallIds.has(opening.wallId)) throw new Error(`Opening ${opening.id} references a missing wall.`);
  }
  for (const object of project.objects) {
    if (object.wallId != null && !wallIds.has(object.wallId)) {
      throw new Error(`Object ${object.id} references a missing wall.`);
    }
    if (object.circuitId != null && !circuitIds.has(object.circuitId)) {
      throw new Error(`Object ${object.id} references a missing circuit.`);
    }
    if (object.roomId != null && !roomIds.has(object.roomId)) {
      throw new Error(`Object ${object.id} references a missing room.`);
    }
  }
  for (const route of [...project.electricalRoutes, ...project.plumbingRoutes]) {
    if (!objectIds.has(route.fromObjectId) || !objectIds.has(route.toObjectId)) {
      throw new Error(`Route ${route.id} references a missing object.`);
    }
  }
  for (const route of project.electricalRoutes) {
    if (route.circuitId != null && !circuitIds.has(route.circuitId)) {
      throw new Error(`Electrical route ${route.id} references a missing circuit.`);
    }
  }
}

export function normaliseProject(input, { validateReferences = true } = {}) {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Project data must be an object.");
  }
  const migrated = migrateProject(input);
  const project = createEmptyProject({
    projectId: typeof migrated.projectId === "string" ? migrated.projectId : null,
    name: typeof migrated.name === "string" && migrated.name.trim() ? migrated.name.trim() : "Untitled renovation",
    renovationView: ["existing", "proposed", "changes"].includes(migrated.renovationView)
      ? migrated.renovationView
      : "existing",
    unit: migrated.unit === "imperial" ? "imperial" : "metric",
    referenceImage: migrated.referenceImage || null,
    layerSettings: cloneLayers(migrated.layerSettings),
  });

  for (const collection of PROJECT_COLLECTIONS) {
    assertArray(migrated[collection] ?? [], collection);
    project[collection] = migrated[collection] ?? [];
  }
  project.walls = project.walls.map((wall) => ({
    renovationStatus: "existing",
    ...wall,
  }));
  project.openings = project.openings.map((opening) => ({
    renovationStatus: "existing",
    ...opening,
  }));
  project.objects = project.objects.map((object) => ({
    renovationStatus: "proposed",
    ...object,
  }));
  project.electricalRoutes = project.electricalRoutes.map((route) => ({
    renovationStatus: "proposed",
    ...route,
  }));
  project.plumbingRoutes = project.plumbingRoutes.map((route) => ({
    renovationStatus: "proposed",
    ...route,
  }));
  assertUniqueIds(project);
  if (validateReferences) assertReferences(project);
  return project;
}

export function parseProject(text) {
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
  return normaliseProject(input);
}

export function serializeProject(project) {
  return JSON.stringify(normaliseProject(project), null, 2);
}

export function nextProjectId(project) {
  return Math.max(
    0,
    ...PROJECT_COLLECTIONS.flatMap((collection) =>
      (project[collection] || []).map((entity) => entity.id || 0),
    ),
  ) + 1;
}
