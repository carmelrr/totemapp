export type RouteDoc = {
  id: string;
  name: string;
  grade: string;       // V-scale string - original grade set by route setter
  color: string;       // hex
  xNorm: number;       // 0..1
  yNorm: number;       // 0..1
  createdAt: any;      // Firestore Timestamp
  status: "active" | "archived" | "draft";
  rating: number;
  tops: number;
  comments: number;
  setter?: string;
  tags?: string[];
  // Community feedback stats
  averageStarRating?: number;   // Average star rating (1-5) from user feedback
  calculatedGrade?: string;     // Community consensus grade (replaces original if exists)
  feedbackCount?: number;       // Number of feedbacks received
  completionCount?: number;     // Number of users who completed the route
};

export type RouteFilters = {
  grades: string[];
  colors: string[];
  status: ("active" | "archived" | "draft")[];
  tags: string[];
};

export type RouteSortBy = "distance" | "grade-asc" | "grade-desc" | "rating" | "newest";

export type MapTransforms = {
  translateX: number;
  translateY: number;
  scale: number;
};

export type ViewportBounds = {
  xMinImg: number;
  yMinImg: number;
  xMaxImg: number;
  yMaxImg: number;
};
