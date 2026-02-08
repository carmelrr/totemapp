// Wall Editor Store - Zustand store for managing editor state

import { create } from 'zustand';
import { 
  Room, 
  Wall, 
  Mat,
  Point, 
  EditorMode, 
  Selection,
  EditorStyles,
  GridConfig,
  TransformState,
  DEFAULT_EDITOR_STYLES,
  DEFAULT_GRID_CONFIG,
  CreateRoomPayload,
  OverlayImage,
  DEFAULT_OVERLAY,
} from '../types';

// Generate unique IDs
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

interface EditorState {
  // Core data
  rooms: Room[];
  currentRoomId: string | null;
  
  // Editor mode
  mode: EditorMode;
  
  // Selection
  selection: Selection;
  
  // Styles
  styles: EditorStyles;
  gridConfig: GridConfig;
  
  // Transform (for viewport)
  transform: TransformState;
  
  // Wall being built
  buildingWall: Wall | null;
  
  // Mat being built
  buildingMat: Mat | null;
  
  // Reference overlay image
  overlay: OverlayImage | null;
  isOverlayAdjusting: boolean;
  
  // History for undo/redo (tracks rooms, buildingWall and buildingMat state)
  history: { rooms: Room[]; buildingWall: Wall | null; buildingMat: Mat | null }[];
  historyIndex: number;
  
  // Loading state
  isLoading: boolean;
  isSaving: boolean;
}

interface EditorActions {
  // Room management
  createRoom: (payload: CreateRoomPayload) => void;
  deleteRoom: (roomId: string) => void;
  setCurrentRoom: (roomId: string | null) => void;
  updateRoomDimensions: (roomId: string, width: number, height: number) => void;
  updateRoomStyle: (roomId: string, updates: Partial<Pick<Room, 'backgroundColor' | 'gridColor' | 'showGrid' | 'gridSize'>>) => void;
  
  // Mode management
  setMode: (mode: EditorMode) => void;
  
  // Selection
  setSelection: (selection: Selection) => void;
  clearSelection: () => void;
  
  // Wall building
  startWall: (point: Point) => void;
  addPointToWall: (point: Point) => void;
  finishWall: (close?: boolean, fillColor?: string, fillOpacity?: number) => void;
  cancelWall: () => void;
  
  // Wall editing
  updateWall: (roomId: string, wallId: string, updates: Partial<Wall>) => void;
  deleteWall: (roomId: string, wallId: string) => void;
  moveWallPoint: (roomId: string, wallId: string, pointIndex: number, newPosition: Point) => void;
  
  // Mat building
  startMat: (point: Point, color?: string, opacity?: number) => void;
  addPointToMat: (point: Point) => void;
  finishMat: () => void;
  cancelMat: () => void;
  
  // Mat editing
  updateMat: (roomId: string, matId: string, updates: Partial<Mat>) => void;
  deleteMat: (roomId: string, matId: string) => void;
  
  // Style updates
  updateStyles: (updates: Partial<EditorStyles>) => void;
  updateGridConfig: (updates: Partial<GridConfig>) => void;
  
  // Transform
  setTransform: (transform: TransformState) => void;
  resetTransform: () => void;
  
  // History
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  
  // Data persistence
  loadRooms: (rooms: Room[]) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  
  // Overlay
  setOverlay: (overlay: OverlayImage | null) => void;
  updateOverlay: (updates: Partial<OverlayImage>) => void;
  setOverlayAdjusting: (adjusting: boolean) => void;
  clearOverlay: () => void;
  
  // Utilities
  getCurrentRoom: () => Room | null;
  snapToGrid: (point: Point) => Point;
  snapToWall: (point: Point, threshold?: number) => { point: Point; wallId: string | null };
}

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  // Initial state
  rooms: [],
  currentRoomId: null,
  mode: 'select',
  selection: { type: 'none' },
  styles: DEFAULT_EDITOR_STYLES,
  gridConfig: DEFAULT_GRID_CONFIG,
  transform: { scale: 1, translateX: 0, translateY: 0 },
  buildingWall: null,
  buildingMat: null,
  overlay: null,
  isOverlayAdjusting: false,
  history: [],
  historyIndex: -1,
  isLoading: false,
  isSaving: false,

  // Room management
  createRoom: (payload) => {
    const newRoom: Room = {
      id: generateId(),
      name: payload.name,
      width: payload.width,
      height: payload.height,
      backgroundColor: get().styles.roomBackgroundColor,
      gridColor: get().styles.gridColor,
      gridSize: payload.gridSize || get().gridConfig.cellSize,
      showGrid: true,
      walls: [],
      mats: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '', // Will be set by caller
    };

    set(state => ({
      rooms: [...state.rooms, newRoom],
      currentRoomId: newRoom.id,
    }));
    
    get().pushHistory();
  },

  deleteRoom: (roomId) => {
    set(state => ({
      rooms: state.rooms.filter(r => r.id !== roomId),
      currentRoomId: state.currentRoomId === roomId ? null : state.currentRoomId,
    }));
    get().pushHistory();
  },

  setCurrentRoom: (roomId) => {
    set({ currentRoomId: roomId });
    get().resetTransform();
  },

  updateRoomDimensions: (roomId, width, height) => {
    set(state => ({
      rooms: state.rooms.map(room => 
        room.id === roomId 
          ? { ...room, width, height, updatedAt: new Date() }
          : room
      ),
    }));
    get().pushHistory();
  },

  updateRoomStyle: (roomId, updates) => {
    set(state => ({
      rooms: state.rooms.map(room =>
        room.id === roomId
          ? { ...room, ...updates, updatedAt: new Date() }
          : room
      ),
    }));
  },

  // Mode management
  setMode: (mode) => {
    // Cancel any in-progress operations when changing mode
    const state = get();
    if (state.buildingWall) {
      get().cancelWall();
    }
    if (state.buildingMat) {
      get().cancelMat();
    }
    set({ mode, selection: { type: 'none' } });
  },

  // Selection
  setSelection: (selection) => set({ selection }),
  clearSelection: () => set({ selection: { type: 'none' } }),

  // Wall building
  startWall: (point) => {
    const snapped = get().snapToGrid(point);
    const newWall: Wall = {
      id: generateId(),
      points: [snapped],
      color: get().styles.wallDefaultColor,
      strokeWidth: get().styles.wallDefaultWidth,
      isClosed: false,
    };
    set({ buildingWall: newWall, mode: 'wall' });
    
    // Push history so starting a wall can be undone
    get().pushHistory();
  },

  addPointToWall: (point) => {
    const { buildingWall, snapToGrid } = get();
    if (!buildingWall) return;

    const snapped = snapToGrid(point);
    
    // Don't add if too close to last point
    const lastPoint = buildingWall.points[buildingWall.points.length - 1];
    const distance = Math.sqrt(
      Math.pow(snapped.x - lastPoint.x, 2) + 
      Math.pow(snapped.y - lastPoint.y, 2)
    );
    
    if (distance < 5) return;

    set({
      buildingWall: {
        ...buildingWall,
        points: [...buildingWall.points, snapped],
      },
    });
    
    // Push history so each point addition can be undone
    get().pushHistory();
  },

  finishWall: (close = false, fillColor?: string, fillOpacity?: number) => {
    const { buildingWall, currentRoomId, styles } = get();
    if (!buildingWall || !currentRoomId) return;
    
    // Need at least 2 points for a wall
    if (buildingWall.points.length < 2) {
      get().cancelWall();
      return;
    }

    const finalWall: Wall = {
      ...buildingWall,
      isClosed: close,
      // Set default fill for closed polygons
      fillColor: close ? (fillColor || buildingWall.fillColor || styles.wallDefaultColor) : undefined,
      fillOpacity: close ? (fillOpacity ?? buildingWall.fillOpacity ?? 0.3) : undefined,
    };

    set(state => ({
      rooms: state.rooms.map(room =>
        room.id === currentRoomId
          ? { ...room, walls: [...room.walls, finalWall], updatedAt: new Date() }
          : room
      ),
      buildingWall: null,
      mode: 'select',
    }));
    
    get().pushHistory();
  },

  cancelWall: () => {
    set({ buildingWall: null });
  },

  // Wall editing
  updateWall: (roomId, wallId, updates) => {
    set(state => ({
      rooms: state.rooms.map(room =>
        room.id === roomId
          ? {
              ...room,
              walls: room.walls.map(wall =>
                wall.id === wallId ? { ...wall, ...updates } : wall
              ),
              updatedAt: new Date(),
            }
          : room
      ),
    }));
    get().pushHistory();
  },

  deleteWall: (roomId, wallId) => {
    set(state => ({
      rooms: state.rooms.map(room =>
        room.id === roomId
          ? {
              ...room,
              walls: room.walls.filter(wall => wall.id !== wallId),
              updatedAt: new Date(),
            }
          : room
      ),
    }));
    get().pushHistory();
  },

  moveWallPoint: (roomId, wallId, pointIndex, newPosition) => {
    const snapped = get().snapToGrid(newPosition);
    set(state => ({
      rooms: state.rooms.map(room =>
        room.id === roomId
          ? {
              ...room,
              walls: room.walls.map(wall =>
                wall.id === wallId
                  ? {
                      ...wall,
                      points: wall.points.map((p, i) =>
                        i === pointIndex ? snapped : p
                      ),
                    }
                  : wall
              ),
              updatedAt: new Date(),
            }
          : room
      ),
    }));
  },

  // Mat building
  startMat: (point, color = '#4A90D9', opacity = 0.5) => {
    const snapped = get().snapToGrid(point);
    const newMat: Mat = {
      id: generateId(),
      points: [snapped],
      color,
      opacity,
    };
    set({ buildingMat: newMat, mode: 'mat' });
    
    // Push history so starting a mat can be undone
    get().pushHistory();
  },

  addPointToMat: (point) => {
    const { buildingMat, snapToGrid } = get();
    if (!buildingMat) return;

    const snapped = snapToGrid(point);
    
    // Don't add if too close to last point
    const lastPoint = buildingMat.points[buildingMat.points.length - 1];
    const distance = Math.sqrt(
      Math.pow(snapped.x - lastPoint.x, 2) + 
      Math.pow(snapped.y - lastPoint.y, 2)
    );
    
    if (distance < 5) return;

    set({
      buildingMat: {
        ...buildingMat,
        points: [...buildingMat.points, snapped],
      },
    });
    
    // Push history so each point addition can be undone
    get().pushHistory();
  },

  finishMat: () => {
    const { buildingMat, currentRoomId } = get();
    if (!buildingMat || !currentRoomId) return;
    
    // Need at least 3 points for a mat polygon
    if (buildingMat.points.length < 3) {
      get().cancelMat();
      return;
    }

    set(state => ({
      rooms: state.rooms.map(room =>
        room.id === currentRoomId
          ? { ...room, mats: [...room.mats, buildingMat], updatedAt: new Date() }
          : room
      ),
      buildingMat: null,
      mode: 'select',
    }));
    
    get().pushHistory();
  },

  cancelMat: () => {
    set({ buildingMat: null });
  },

  // Mat editing
  updateMat: (roomId, matId, updates) => {
    set(state => ({
      rooms: state.rooms.map(room =>
        room.id === roomId
          ? {
              ...room,
              mats: room.mats.map(mat =>
                mat.id === matId ? { ...mat, ...updates } : mat
              ),
              updatedAt: new Date(),
            }
          : room
      ),
    }));
    get().pushHistory();
  },

  deleteMat: (roomId, matId) => {
    set(state => ({
      rooms: state.rooms.map(room =>
        room.id === roomId
          ? {
              ...room,
              mats: room.mats.filter(mat => mat.id !== matId),
              updatedAt: new Date(),
            }
          : room
      ),
    }));
    get().pushHistory();
  },

  // Style updates
  updateStyles: (updates) => {
    set(state => ({
      styles: { ...state.styles, ...updates },
    }));
  },

  updateGridConfig: (updates) => {
    set(state => ({
      gridConfig: { ...state.gridConfig, ...updates },
    }));
  },

  // Transform
  setTransform: (transform) => set({ transform }),
  resetTransform: () => set({ transform: { scale: 1, translateX: 0, translateY: 0 } }),

  // History
  pushHistory: () => {
    const { rooms, buildingWall, buildingMat, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      rooms: JSON.parse(JSON.stringify(rooms)),
      buildingWall: buildingWall ? JSON.parse(JSON.stringify(buildingWall)) : null,
      buildingMat: buildingMat ? JSON.parse(JSON.stringify(buildingMat)) : null,
    });
    
    // Keep max 50 history states
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    
    const newIndex = historyIndex - 1;
    const historyState = history[newIndex];
    set({
      rooms: JSON.parse(JSON.stringify(historyState.rooms)),
      buildingWall: historyState.buildingWall ? JSON.parse(JSON.stringify(historyState.buildingWall)) : null,
      buildingMat: historyState.buildingMat ? JSON.parse(JSON.stringify(historyState.buildingMat)) : null,
      historyIndex: newIndex,
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    
    const newIndex = historyIndex + 1;
    const historyState = history[newIndex];
    set({
      rooms: JSON.parse(JSON.stringify(historyState.rooms)),
      buildingWall: historyState.buildingWall ? JSON.parse(JSON.stringify(historyState.buildingWall)) : null,
      buildingMat: historyState.buildingMat ? JSON.parse(JSON.stringify(historyState.buildingMat)) : null,
      historyIndex: newIndex,
    });
  },

  // Data persistence
  loadRooms: (rooms) => {
    set({ rooms, historyIndex: -1, history: [] });
    get().pushHistory();
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setSaving: (saving) => set({ isSaving: saving }),

  // Overlay management
  setOverlay: (overlay) => set({ overlay }),
  
  updateOverlay: (updates) => {
    const { overlay } = get();
    if (!overlay) return;
    set({ overlay: { ...overlay, ...updates } });
  },
  
  setOverlayAdjusting: (adjusting) => set({ isOverlayAdjusting: adjusting }),
  
  clearOverlay: () => set({ overlay: null, isOverlayAdjusting: false }),

  // Utilities
  getCurrentRoom: () => {
    const { rooms, currentRoomId } = get();
    return rooms.find(r => r.id === currentRoomId) || null;
  },

  snapToGrid: (point) => {
    const room = get().getCurrentRoom();
    if (!room) return point;
    
    const gridSize = room.gridSize;
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize,
    };
  },

  snapToWall: (point, threshold) => {
    const room = get().getCurrentRoom();
    const snapThreshold = threshold || get().styles.snapThreshold;
    
    if (!room || room.walls.length === 0) {
      return { point, wallId: null };
    }

    let closestPoint = point;
    let closestDistance = Infinity;
    let closestWallId: string | null = null;

    for (const wall of room.walls) {
      for (let i = 0; i < wall.points.length - 1; i++) {
        const p1 = wall.points[i];
        const p2 = wall.points[i + 1];
        
        // Find closest point on line segment
        const nearestOnLine = nearestPointOnSegment(point, p1, p2);
        const distance = Math.sqrt(
          Math.pow(nearestOnLine.x - point.x, 2) +
          Math.pow(nearestOnLine.y - point.y, 2)
        );
        
        if (distance < closestDistance && distance < snapThreshold) {
          closestDistance = distance;
          closestPoint = nearestOnLine;
          closestWallId = wall.id;
        }
      }
    }

    return { point: closestPoint, wallId: closestWallId };
  },
}));

/**
 * Find the nearest point on a line segment to a given point
 */
function nearestPointOnSegment(point: Point, p1: Point, p2: Point): Point {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lengthSquared = dx * dx + dy * dy;
  
  if (lengthSquared === 0) {
    return p1;
  }
  
  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  
  return {
    x: p1.x + t * dx,
    y: p1.y + t * dy,
  };
}

export default useEditorStore;
