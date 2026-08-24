import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProject } from "./project.js";
import { deleteProjectFromLibrary, duplicateProjectInLibrary, listProjects, saveProjectToLibrary } from "./projectStore.js";

function memoryStorage(limit = Infinity) {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (value.length > limit) throw new Error("quota");
      data.set(key, value);
    },
  };
}

test("project library saves, updates, duplicates, orders and deletes projects", () => {
  const storage = memoryStorage();
  const first = saveProjectToLibrary(createEmptyProject({ name: "Kitchen" }), { storage, id: "a", now: "2026-01-01" });
  saveProjectToLibrary({ ...first.project, name: "Kitchen revised" }, { storage, now: "2026-01-02" });
  duplicateProjectInLibrary(first.project, { storage, id: "b", now: "2026-01-03" });
  assert.deepEqual(listProjects(storage).map(({ id }) => id), ["b", "a"]);
  assert.equal(listProjects(storage).find(({ id }) => id === "a").name, "Kitchen revised");
  deleteProjectFromLibrary("a", storage);
  assert.deepEqual(listProjects(storage).map(({ id }) => id), ["b"]);
});

test("library retries without a large reference image when storage quota is exceeded", () => {
  const storage = memoryStorage(1500);
  const result = saveProjectToLibrary(
    createEmptyProject({ referenceImage: { src: "x".repeat(2000), name: "plan.jpg" } }),
    { storage, id: "a", now: "2026-01-01" },
  );
  assert.equal(result.referenceOmitted, true);
  assert.equal(result.project.referenceImage.name, "plan.jpg");
  assert.equal(listProjects(storage)[0].project.referenceImage, null);
});
