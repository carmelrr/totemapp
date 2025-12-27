// src/index.ts - מרכז ייצואים לארכיטקטורה החדשה

// ===== COMPONENTS =====
// Note: BottomToolbar, FloatingPanel, ToolButton are available but not currently used
// Re-enable exports when implementing new features:
// export { ToolButton } from "@/components/ui/ToolButton";
// export { BottomToolbar } from "@/components/ui/BottomToolbar";
// export { FloatingPanel } from "@/components/ui/FloatingPanel";

// ===== STORES =====
export { useRouteStore } from "@/features/routes/store";

// ===== TYPES =====
export type { Vec2 } from "@/types/geometry";

export type {
  Route,
  Hold,
  Volume,
  HoldRole,
  RouteAction,
  RouteState,
} from "@/features/routes/types";

// ===== UTILITIES =====
export * from "@/utils/geometry";
export * from "@/utils/throttle";

// ===== FEATURES =====
export * from "@/features/routes/outline";
export * from "@/features/routes/symmetry";
export * from "@/features/routes/validators";

export * from "@/features/data/firebase";

// ===== CONSTANTS =====
export * from "@/constants/colors";
export * from "@/constants/roles";
