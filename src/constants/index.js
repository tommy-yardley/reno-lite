// Central constants shared across the app. Keeping these in one place makes the
// "what does this app consider a default" question answerable from one file.

export const INCH_PER_METER = 39.3700787;

export const ROOM_TYPES = ["Bedroom", "Living Room", "Kitchen", "Bathroom", "Office", "Hallway", "Other"];
export const ROOM_COLORS = ["#B8863E", "#6FA98C", "#5E86A8", "#B58657", "#A98CC9", "#C97E8C"];

export const VOID_COLOR = "#5F5347";
export const WINDOW_COLOR = "#5E86A8";
export const DOOR_COLOR = "#C97E8C";
export const SELECTION_COLOR = "#6FA98C"; // one consistent "this is selected" color across walls/doors/windows/furniture/corners

export const DEFAULT_WALL_THICKNESS_IN = 5;
export const SILL_HEIGHT_IN = 32; // rough typical window sill height; taller furniture risks blocking the window

export const DEFAULT_DOOR_WIDTH_IN = 32;
export const DEFAULT_WINDOW_WIDTH_IN = 36;
export const DOOR_WIDTH_PRESETS_IN = [24, 28, 30, 32, 36];
export const WINDOW_WIDTH_PRESETS_IN = [24, 30, 36, 48, 60];

// Theme palette ("Refined Blueprint") — kept here so a future theme swap is a
// one-file change rather than a find-and-replace across components.
export const THEME = {
  paper: "#F3EEE3",
  paperGradientEnd: "#ECE4D2",
  panel: "#FBF8F1",
  ink: "#1B2B3A",
  border: "#D8CCB0",
  labelStrong: "#5B6B78",
  labelMuted: "#8A97A3",
  accent: "#B8863E",
  danger: "#B2483A",
  dangerBorder: "#7A3F38",
  dangerBg: "rgba(224,85,74,0.08)",
  dangerText: "#8B4038",
  warnStroke: "#E0554A",
  escapeStroke: "#E0954A",
  ok: "#6FA98C",
};
