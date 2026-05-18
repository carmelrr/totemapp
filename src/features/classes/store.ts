/**
 * @fileoverview UI-only state for the Class Planning screen.
 * Domain data lives in Firestore and is consumed via hooks.
 */

import { create } from "zustand";
import type { BoardViewMode, DayOfWeek } from "./types";

interface ClassPlannerUIState {
  viewMode: BoardViewMode;
  selectedDay: DayOfWeek | "all";
  editingGroupId: string | null;
  editingLocationId: string | null;
  editingProgramId: string | null;
  showSettings: boolean;

  setViewMode: (v: BoardViewMode) => void;
  setSelectedDay: (d: DayOfWeek | "all") => void;
  openGroupEditor: (id: string | "new" | null) => void;
  openLocationEditor: (id: string | "new" | null) => void;
  openProgramEditor: (id: string | "new" | null) => void;
  setShowSettings: (v: boolean) => void;
}

export const useClassPlannerUI = create<ClassPlannerUIState>((set) => ({
  viewMode: "schedule",
  selectedDay: "all",
  editingGroupId: null,
  editingLocationId: null,
  editingProgramId: null,
  showSettings: false,

  setViewMode: (v) => set({ viewMode: v }),
  setSelectedDay: (d) => set({ selectedDay: d }),
  openGroupEditor: (id) => set({ editingGroupId: id }),
  openLocationEditor: (id) => set({ editingLocationId: id }),
  openProgramEditor: (id) => set({ editingProgramId: id }),
  setShowSettings: (v) => set({ showSettings: v }),
}));
