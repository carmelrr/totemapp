export interface Route {
  id: string;
  name: string;
  number: number;
  color: string;
  difficulty: string;
  grade?: string;
  description?: string;
  coordinates: {
    x: number;
    y: number;
  };
  createdAt: Date;
  createdBy: string;
  wallId: string;
}

export interface Rating {
  id: string;
  routeId: string;
  userId: string;
  rating: number; // 1-5 stars
  createdAt: Date;
  updatedAt: Date;
}

export interface Feedback {
  id: string;
  routeId: string;
  userId: string;
  text: string;
  rating?: number; // Optional rating with feedback
  createdAt: Date;
  updatedAt: Date;
  user: {
    displayName: string;
    photoURL?: string;
  };
  likes?: number; // Optional likes count
  media?: string; // Optional image/video URL
}

export interface RouteFilter {
  difficulty?: string[];
  grade?: string[];
  color?: string[];
  search?: string;
}

export interface RouteSortOption {
  field: 'name' | 'number' | 'difficulty' | 'createdAt' | 'rating';
  direction: 'asc' | 'desc';
}

export type RouteCreateData = Omit<Route, 'id' | 'createdAt'>;
export type RouteUpdateData = Partial<Omit<Route, 'id' | 'createdAt' | 'createdBy'>>;

export interface RouteWithStats extends Route {
  averageRating?: number;
  ratingCount: number;
  feedbackCount: number;
}
