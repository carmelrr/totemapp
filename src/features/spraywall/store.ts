// features/spraywall/store.ts
import { create } from 'zustand';
import { Wall, GridSpec, Symmetry, Transform } from './types';

interface SprayWallState {
  // Current wall
  currentWall: Wall | null;
  
  // View transform (pan/zoom)
  transform: Transform;
  
  // Grid settings
  currentGrid: GridSpec | null;
  gridVisible: boolean;
  
  // Symmetry settings
  currentSymmetry: Symmetry | null;
  symmetryVisible: boolean;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentWall: (wall: Wall | null) => void;
  updateWall: (updates: Partial<Wall>) => void;
  
  setTransform: (transform: Partial<Transform>) => void;
  resetTransform: () => void;
  
  setGrid: (grid: GridSpec | null) => void;
  updateGrid: (updates: Partial<GridSpec>) => void;
  toggleGridVisible: () => void;
  
  setSymmetry: (symmetry: Symmetry | null) => void;
  toggleSymmetryVisible: () => void;
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSprayWallStore = create<SprayWallState>((set, get) => ({
  // Initial state
  currentWall: null,
  transform: { scale: 1, tx: 0, ty: 0 },
  currentGrid: null,
  gridVisible: false,
  currentSymmetry: null,
  symmetryVisible: false,
  isLoading: false,
  error: null,

  // Wall actions
  setCurrentWall: (wall) => set({ currentWall: wall }),
  
  updateWall: (updates) => set((state) => ({
    currentWall: state.currentWall ? { ...state.currentWall, ...updates } : null
  })),

  // Transform actions
  setTransform: (transformUpdates) => set((state) => ({
    transform: { ...state.transform, ...transformUpdates }
  })),
  
  resetTransform: () => set({ transform: { scale: 1, tx: 0, ty: 0 } }),

  // Grid actions
  setGrid: (grid) => set({ currentGrid: grid }),
  
  updateGrid: (updates) => set((state) => ({
    currentGrid: state.currentGrid ? { ...state.currentGrid, ...updates } : null
  })),
  
  toggleGridVisible: () => set((state) => ({ gridVisible: !state.gridVisible })),

  // Symmetry actions
  setSymmetry: (symmetry) => set({ currentSymmetry: symmetry }),
  
  toggleSymmetryVisible: () => set((state) => ({ 
    symmetryVisible: !state.symmetryVisible 
  })),

  // UI actions
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
