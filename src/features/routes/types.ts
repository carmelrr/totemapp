// routes/types.ts
export type HoldRole = "start" | "finish" | "hand" | "foot" | "any";

export interface Hold {
  id: string;
  x: number; 
  y: number;               // בקואורדינטת קיר קנונית
  role: HoldRole;
  color: string;           // hex
  size: number;            // רדיוס בקנון
  clusterId?: string;      // לאאוטליין
}

export interface Volume {
  id: string;
  points: {x:number;y:number}[]; // פוליגון
  color: string;
  name?: string;
}

export interface Route {
  id: string;
  wallId: string;
  name: string;
  grade: string;           // V-scale וכד'
  holds: Hold[];
  volumes?: Volume[];
  meta?: Record<string, any>;
  createdAt: number;
  createdBy: string;
  style?: string;          // boulder, lead, etc.
  tags?: string[];
}

export interface RouteAction {
  type: 'ADD_HOLD' | 'REMOVE_HOLD' | 'UPDATE_HOLD' | 'ADD_VOLUME' | 'REMOVE_VOLUME' | 'SET_ROUTE_META';
  payload: any;
  timestamp: number;
}

export interface RouteState {
  route: Partial<Route>;
  selectedHoldIndex: number;
  selectedTool: 'circle' | 'dot' | 'volume' | 'outline';
  history: RouteAction[];
  historyIndex: number;
}

export interface Vec2 {
  x: number;
  y: number;
}
