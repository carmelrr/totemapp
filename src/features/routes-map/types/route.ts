export type RouteDoc = {
  id: string;
  name: string;
  grade: string;       // V-scale string
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
