export const RENOVATION_STATUSES = {
  existing: { label: "Existing", colour: "#5B6B78" },
  proposed: { label: "Proposed", colour: "#2F78C4" },
  demolish: { label: "Remove", colour: "#B2483A" },
};

export const RENOVATION_VIEWS = {
  existing: { label: "Existing", description: "Measured survey and items to remove" },
  proposed: { label: "Proposed", description: "Finished layout after renovation" },
  changes: { label: "Changes", description: "Highlight additions and removals" },
};

export function renovationStatus(entity, fallback = "existing") {
  return RENOVATION_STATUSES[entity?.renovationStatus] ? entity.renovationStatus : fallback;
}

export function visibleInRenovationView(entity, view, fallback = "existing") {
  const status = renovationStatus(entity, fallback);
  if (view === "existing") return status !== "proposed";
  if (view === "proposed") return status !== "demolish";
  return true;
}

export function renovationAppearance(entity, view, fallback = "existing") {
  const status = renovationStatus(entity, fallback);
  if (view !== "changes") return { status, opacity: 1 };
  if (status === "existing") return { status, opacity: 0.24, colour: "#8A97A3" };
  if (status === "demolish") return { status, opacity: 0.9, colour: "#B2483A", dash: "7 4" };
  return { status, opacity: 1, colour: "#2F78C4", dash: "3 2" };
}
