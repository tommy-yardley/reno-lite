const directedKey = (wallId, fromNodeId) => `${wallId}:${fromNodeId}`;

export function boundaryKey(wallIds) {
  return [...wallIds].sort((a, b) => a - b).join(".");
}

function signedArea(points) {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[(index + 1) % points.length];
    sum += point.x * next.y - next.x * point.y;
  }
  return sum / 2;
}

export function derivePlanFaces(nodes, walls, epsilon = 0.01) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));

  for (const wall of walls) {
    const start = nodeMap.get(wall.startNodeId);
    const end = nodeMap.get(wall.endNodeId);
    if (!start || !end || start.id === end.id) continue;
    outgoing.get(start.id)?.push({
      wallId: wall.id,
      fromNodeId: start.id,
      toNodeId: end.id,
      angle: Math.atan2(end.y - start.y, end.x - start.x),
    });
    outgoing.get(end.id)?.push({
      wallId: wall.id,
      fromNodeId: end.id,
      toNodeId: start.id,
      angle: Math.atan2(start.y - end.y, start.x - end.x),
    });
  }
  for (const edges of outgoing.values()) edges.sort((left, right) => left.angle - right.angle);

  const visited = new Set();
  const faces = [];
  const maximumSteps = Math.max(1, walls.length * 2 + 1);

  for (const edges of outgoing.values()) {
    for (const first of edges) {
      const firstKey = directedKey(first.wallId, first.fromNodeId);
      if (visited.has(firstKey)) continue;
      const nodeIds = [];
      const wallIds = [];
      let edge = first;
      let closed = false;

      for (let step = 0; step < maximumSteps; step += 1) {
        const key = directedKey(edge.wallId, edge.fromNodeId);
        if (visited.has(key)) {
          closed = key === firstKey;
          break;
        }
        visited.add(key);
        nodeIds.push(edge.fromNodeId);
        wallIds.push(edge.wallId);

        const choices = outgoing.get(edge.toNodeId) || [];
        const reverseIndex = choices.findIndex(
          (candidate) =>
            candidate.wallId === edge.wallId && candidate.toNodeId === edge.fromNodeId,
        );
        if (reverseIndex < 0 || !choices.length) break;
        edge = choices[(reverseIndex - 1 + choices.length) % choices.length];
        if (directedKey(edge.wallId, edge.fromNodeId) === firstKey) {
          closed = true;
          break;
        }
      }

      const points = nodeIds.map((id) => nodeMap.get(id)).filter(Boolean);
      const area = points.length >= 3 ? signedArea(points) : 0;
      if (!closed || points.length < 3 || area <= epsilon) continue;
      faces.push({
        nodeIds,
        wallIds,
        boundaryKey: boundaryKey(wallIds),
        area,
      });
    }
  }

  return [...new Map(faces.map((face) => [face.boundaryKey, face])).values()].sort(
    (left, right) => right.area - left.area,
  );
}

function sharedBoundaryCount(room, face) {
  const wallIds = new Set(room.wallIds || []);
  return face.wallIds.reduce((count, id) => count + Number(wallIds.has(id)), 0);
}

export function reconcileProjectFaces(project, createId) {
  const faces = derivePlanFaces(project.nodes, project.walls);
  const remainingRooms = new Map(project.rooms.map((room) => [room.id, room]));
  const claimedRoomIds = new Set();
  const roomIdMap = new Map();

  const rooms = faces.map((face, index) => {
    const exact = project.rooms.find(
      (room) =>
        !claimedRoomIds.has(room.id) &&
        (room.boundaryKey || boundaryKey(room.wallIds || [])) === face.boundaryKey,
    );
    const fallback = exact
      ? null
      : [...remainingRooms.values()]
          .filter((room) => !claimedRoomIds.has(room.id))
          .map((room) => ({ room, overlap: sharedBoundaryCount(room, face) }))
          .sort((left, right) => right.overlap - left.overlap)[0];
    const previous = exact || (fallback?.overlap > 0 ? fallback.room : null);
    const id = previous?.id || createId();
    if (previous) claimedRoomIds.add(previous.id);
    roomIdMap.set(previous?.id ?? id, id);
    return {
      id,
      name: previous?.name || `Room ${index + 1}`,
      type: previous?.type || "Room",
      classification: previous?.classification || "room",
      hostRoomId: previous?.hostRoomId || null,
      color: previous?.color || "#B9D8C2",
      ...previous,
      nodeIds: face.nodeIds,
      wallIds: face.wallIds,
      boundaryKey: face.boundaryKey,
    };
  });

  for (const room of project.rooms) {
    if (roomIdMap.has(room.id)) continue;
    const best = rooms
      .map((candidate) => ({ candidate, overlap: sharedBoundaryCount(room, candidate) }))
      .sort((left, right) => right.overlap - left.overlap)[0];
    if (best?.overlap > 0) roomIdMap.set(room.id, best.candidate.id);
  }

  const roomIds = new Set(rooms.map((room) => room.id));
  const remapRoomId = (roomId) => {
    if (roomId == null) return null;
    const mapped = roomIdMap.get(roomId);
    return mapped != null && roomIds.has(mapped) ? mapped : null;
  };

  return {
    ...project,
    rooms: rooms.map((room) => ({
      ...room,
      hostRoomId: room.classification === "void" ? remapRoomId(room.hostRoomId) : null,
    })),
    objects: project.objects.map((object) =>
      object.roomId == null ? object : { ...object, roomId: remapRoomId(object.roomId) },
    ),
  };
}
