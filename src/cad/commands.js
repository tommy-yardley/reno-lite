const entityMap = {
  node: "nodes",
  wall: "walls",
  room: "rooms",
  opening: "openings",
  object: "objects",
  electricalCircuit: "electricalCircuits",
  electricalRoute: "electricalRoutes",
  plumbingRoute: "plumbingRoutes",
  shoppingItem: "shoppingItems",
};

const collectionFor = (entity) => {
  const collection = entityMap[entity];
  if (!collection) throw new Error(`Unknown project entity "${entity}".`);
  return collection;
};

function removeObjectsAndRoutes(project, objectIds) {
  const ids = new Set(objectIds);
  return {
    ...project,
    objects: project.objects.filter((object) => !ids.has(object.id)),
    electricalRoutes: project.electricalRoutes.filter(
      (route) => !ids.has(route.fromObjectId) && !ids.has(route.toObjectId),
    ),
    plumbingRoutes: project.plumbingRoutes.filter(
      (route) => !ids.has(route.fromObjectId) && !ids.has(route.toObjectId),
    ),
  };
}

function deleteEntities(project, entity, entityIds) {
  const ids = new Set(entityIds);
  if (!ids.size) return project;

  if (entity === "wall") {
    const deletedObjectIds = project.objects
      .filter((object) => ids.has(object.wallId))
      .map((object) => object.id);
    const walls = project.walls.filter((wall) => !ids.has(wall.id));
    const usedNodeIds = new Set(walls.flatMap((wall) => [wall.startNodeId, wall.endNodeId]));
    return removeObjectsAndRoutes(
      {
        ...project,
        nodes: project.nodes.filter((node) => usedNodeIds.has(node.id)),
        walls,
        rooms: project.rooms.filter((room) => !room.wallIds.some((id) => ids.has(id))),
        openings: project.openings.filter((opening) => !ids.has(opening.wallId)),
      },
      deletedObjectIds,
    );
  }

  if (entity === "room") {
    return {
      ...project,
      rooms: project.rooms
        .filter((room) => !ids.has(room.id))
        .map((room) => (ids.has(room.hostRoomId) ? { ...room, hostRoomId: null } : room)),
      objects: project.objects.map((object) =>
        ids.has(object.roomId) ? { ...object, roomId: null } : object,
      ),
    };
  }

  if (entity === "object") return removeObjectsAndRoutes(project, ids);

  if (entity === "electricalCircuit") {
    return {
      ...project,
      electricalCircuits: project.electricalCircuits.filter((circuit) => !ids.has(circuit.id)),
      electricalRoutes: project.electricalRoutes.filter((route) => !ids.has(route.circuitId)),
      objects: project.objects.map((object) =>
        ids.has(object.circuitId) ? { ...object, circuitId: null } : object,
      ),
    };
  }

  const collection = collectionFor(entity);
  const next = project[collection].filter((item) => !ids.has(item.id));
  return next.length === project[collection].length ? project : { ...project, [collection]: next };
}

export function applyProjectCommand(project, command) {
  if (!command || typeof command.type !== "string") throw new Error("A project command needs a type.");

  if (command.type === "patch-entities") {
    const collection = collectionFor(command.entity);
    const ids = new Set(command.ids || []);
    if (!ids.size) return project;
    let changed = false;
    const next = project[collection].map((item) => {
      if (!ids.has(item.id)) return item;
      changed = true;
      return { ...item, ...command.changes };
    });
    return changed ? { ...project, [collection]: next } : project;
  }

  if (command.type === "replace-entities") {
    const collection = collectionFor(command.entity);
    const replacements = new Map((command.entities || []).map((item) => [item.id, item]));
    if (!replacements.size) return project;
    let changed = false;
    const next = project[collection].map((item) => {
      const replacement = replacements.get(item.id);
      if (!replacement) return item;
      changed = true;
      return { ...item, ...replacement };
    });
    return changed ? { ...project, [collection]: next } : project;
  }

  if (command.type === "append-entity") {
    const collection = collectionFor(command.entity);
    return { ...project, [collection]: [...project[collection], command.value] };
  }

  if (command.type === "delete-entities") {
    return deleteEntities(project, command.entity, command.ids || []);
  }

  if (command.type === "set-layer") {
    if (!project.layerSettings[command.layer]) throw new Error(`Unknown layer "${command.layer}".`);
    return {
      ...project,
      layerSettings: {
        ...project.layerSettings,
        [command.layer]: { ...project.layerSettings[command.layer], ...command.changes },
      },
    };
  }

  throw new Error(`Unknown project command "${command.type}".`);
}

export const projectCommands = {
  patch: (entity, ids, changes, label = "Edit item") => ({
    type: "patch-entities",
    entity,
    ids,
    changes,
    label,
  }),
  replace: (entity, entities, label = "Move items") => ({
    type: "replace-entities",
    entity,
    entities,
    label,
  }),
  append: (entity, value, label = "Add item") => ({
    type: "append-entity",
    entity,
    value,
    label,
  }),
  remove: (entity, ids, label = "Delete item") => ({
    type: "delete-entities",
    entity,
    ids,
    label,
  }),
  setLayer: (layer, changes) => ({
    type: "set-layer",
    layer,
    changes,
    label: "Change layer",
  }),
};
