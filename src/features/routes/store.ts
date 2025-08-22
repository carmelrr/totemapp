// features/routes/store.ts
import { Hold, Route, RouteAction, RouteState, HoldRole } from "./types";

// Mock של zustand עד שנתקין אותו
interface RouteStore extends RouteState {
  // Route actions
  setRoute: (route: Partial<Route>) => void;
  updateRouteMeta: (meta: Partial<Route>) => void;

  // Hold actions
  addHold: (hold: Omit<Hold, "id">) => void;
  removeHold: (holdId: string) => void;
  updateHold: (holdId: string, updates: Partial<Hold>) => void;
  selectHold: (index: number) => void;
  deselectHold: () => void;

  // Tool actions
  setSelectedTool: (tool: "circle" | "dot" | "volume" | "outline") => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Bulk operations
  clearAllHolds: () => void;
  groupHolds: (holdIds: string[], clusterId: string) => void;
  applySymmetry: (symmetryType: string, params: any) => void;

  // Validation
  validate: () => { isValid: boolean; errors: string[]; warnings: string[] };
}

// זמנית - מימוש פשוט ללא zustand
let store: RouteStore;

export const useRouteStore = (): RouteStore => {
  if (!store) {
    store = createRouteStore();
  }
  return store;
};

function createRouteStore(): RouteStore {
  let state: RouteState = {
    route: { holds: [] },
    selectedHoldIndex: -1,
    selectedTool: "circle",
    history: [],
    historyIndex: -1,
  };

  const addAction = (action: Omit<RouteAction, "timestamp">) => {
    const newAction: RouteAction = { ...action, timestamp: Date.now() };
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(newAction);
    state.historyIndex = state.history.length - 1;
  };

  return {
    ...state,

    setRoute: (route) => {
      state.route = { ...state.route, ...route };
    },

    updateRouteMeta: (meta) => {
      state.route = { ...state.route, ...meta };
      addAction({ type: "SET_ROUTE_META", payload: meta });
    },

    addHold: (holdData) => {
      const newHold: Hold = {
        ...holdData,
        id: `hold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      state.route.holds = [...(state.route.holds || []), newHold];
      addAction({ type: "ADD_HOLD", payload: newHold });
    },

    removeHold: (holdId) => {
      state.route.holds = (state.route.holds || []).filter(
        (h) => h.id !== holdId,
      );
      addAction({ type: "REMOVE_HOLD", payload: { holdId } });
    },

    updateHold: (holdId, updates) => {
      state.route.holds = (state.route.holds || []).map((h) =>
        h.id === holdId ? { ...h, ...updates } : h,
      );
      addAction({ type: "UPDATE_HOLD", payload: { holdId, updates } });
    },

    selectHold: (index) => {
      state.selectedHoldIndex = index;
    },

    deselectHold: () => {
      state.selectedHoldIndex = -1;
    },

    setSelectedTool: (tool) => {
      state.selectedTool = tool;
    },

    undo: () => {
      if (state.historyIndex > 0) {
        state.historyIndex--;
        // TODO: Apply reverse action
      }
    },

    redo: () => {
      if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        // TODO: Apply forward action
      }
    },

    canUndo: () => state.historyIndex > 0,
    canRedo: () => state.historyIndex < state.history.length - 1,

    clearAllHolds: () => {
      state.route.holds = [];
      addAction({ type: "REMOVE_HOLD", payload: { all: true } });
    },

    groupHolds: (holdIds, clusterId) => {
      state.route.holds = (state.route.holds || []).map((h) =>
        holdIds.includes(h.id) ? { ...h, clusterId } : h,
      );
    },

    applySymmetry: (symmetryType, params) => {
      // TODO: Implement symmetry application
    },

    validate: () => {
      // Basic validation
      const holds = state.route.holds || [];
      const errors: string[] = [];
      const warnings: string[] = [];

      if (holds.length === 0) {
        errors.push("No holds added");
      }

      const startHolds = holds.filter((h) => h.role === "start");
      if (startHolds.length === 0) {
        errors.push("No start holds");
      }

      const finishHolds = holds.filter((h) => h.role === "finish");
      if (finishHolds.length === 0) {
        errors.push("No finish holds");
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    },
  };
}
