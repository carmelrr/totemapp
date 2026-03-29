import { create } from 'zustand';

interface BalanceModeState {
  isActive: boolean;
  balanceDate: string | null;
  dateRouteIds: Set<string>;
  extremeRouteIds: string[];
  previousPositions: Record<string, { xNorm: number; yNorm: number }> | null;

  startBalanceMode: (date: string, dateRouteIds: string[]) => void;
  toggleExtremeRoute: (id: string) => void;
  setPreviousPositions: (positions: Record<string, { xNorm: number; yNorm: number }>) => void;
  clearPreviousPositions: () => void;
  reset: () => void;
}

export const useBalanceModeStore = create<BalanceModeState>((set, get) => ({
  isActive: false,
  balanceDate: null,
  dateRouteIds: new Set(),
  extremeRouteIds: [],
  previousPositions: null,

  startBalanceMode: (date, dateRouteIds) => {
    set({
      isActive: true,
      balanceDate: date,
      dateRouteIds: new Set(dateRouteIds),
      extremeRouteIds: [],
    });
  },

  toggleExtremeRoute: (id) => {
    const { extremeRouteIds, dateRouteIds } = get();
    if (!dateRouteIds.has(id)) return;

    if (extremeRouteIds.includes(id)) {
      set({ extremeRouteIds: extremeRouteIds.filter((r) => r !== id) });
    } else if (extremeRouteIds.length < 2) {
      set({ extremeRouteIds: [...extremeRouteIds, id] });
    } else {
      // FIFO: replace the first selected extreme
      set({ extremeRouteIds: [extremeRouteIds[1], id] });
    }
  },

  setPreviousPositions: (positions) => {
    set({ previousPositions: positions });
  },

  clearPreviousPositions: () => {
    set({ previousPositions: null });
  },

  reset: () => {
    set({
      isActive: false,
      balanceDate: null,
      dateRouteIds: new Set(),
      extremeRouteIds: [],
      previousPositions: null,
    });
  },
}));
