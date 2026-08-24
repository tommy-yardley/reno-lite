import { normaliseProject } from "./project.js";

export const PROJECT_LIBRARY_KEY = "reno-lite:project-library-v1";

const createId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

function readRaw(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(PROJECT_LIBRARY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listProjects(storage = globalThis.localStorage) {
  return readRaw(storage)
    .flatMap((entry) => {
      try {
        const project = normaliseProject(entry.project);
        return [{
          id: entry.id,
          name: project.name,
          updatedAt: entry.updatedAt,
          project,
        }];
      } catch {
        return [];
      }
    })
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
}

export function saveProjectToLibrary(project, {
  storage = globalThis.localStorage,
  id = project.projectId || createId(),
  now = new Date().toISOString(),
} = {}) {
  const normalised = normaliseProject({ ...project, projectId: id });
  const entries = readRaw(storage);
  const next = [
    { id, updatedAt: now, project: normalised },
    ...entries.filter((entry) => entry.id !== id),
  ];
  try {
    storage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify(next));
    return { project: normalised, referenceOmitted: false };
  } catch (error) {
    if (!normalised.referenceImage) throw error;
    const withoutReference = { ...normalised, referenceImage: null };
    storage.setItem(
      PROJECT_LIBRARY_KEY,
      JSON.stringify([
        { id, updatedAt: now, project: withoutReference },
        ...entries.filter((entry) => entry.id !== id),
      ]),
    );
    return { project: normalised, referenceOmitted: true };
  }
}

export function deleteProjectFromLibrary(id, storage = globalThis.localStorage) {
  const next = readRaw(storage).filter((entry) => entry.id !== id);
  storage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify(next));
}

export function duplicateProjectInLibrary(project, options = {}) {
  const id = options.id || createId();
  return saveProjectToLibrary(
    { ...project, projectId: id, name: `${project.name} copy` },
    { ...options, id },
  );
}
