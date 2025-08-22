// features/routes/outline.ts
import { Vec2 } from "../spraywall/types";
import { Hold } from "./types";

// Convex Hull פשוט (Andrew's monotone chain algorithm)
export function convexHull(points: Vec2[]): Vec2[] {
  if (points.length <= 3) return points.slice();

  // מיון נקודות לפי x ואז y
  const pts = points
    .slice()
    .sort((p, q) => (p.x === q.x ? p.y - q.y : p.x - q.x));

  const cross = (o: Vec2, a: Vec2, b: Vec2) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  // בניית החלק התחתון
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  // בניית החלק העליון
  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  // הסרת הנקודה האחרונה של כל חלק (היא חוזרת)
  upper.pop();
  lower.pop();

  return lower.concat(upper);
}

// יצירת קונטור של אחיזות
export function createHoldOutline(holds: Hold[]): Vec2[] {
  if (holds.length === 0) return [];

  const points: Vec2[] = holds.map((hold) => ({ x: hold.x, y: hold.y }));

  if (points.length === 1) {
    // אחיזה יחידה - צור עיגול קטן סביבה
    const center = points[0];
    const radius = 0.02; // רדיוס קטן בקואורדינטות נורמליזציה
    const numPoints = 12;

    const circlePoints: Vec2[] = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      circlePoints.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      });
    }
    return circlePoints;
  }

  if (points.length === 2) {
    // שתי אחיזות - צור מלבן דק סביבן
    const p1 = points[0];
    const p2 = points[1];
    const thickness = 0.01;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return [p1]; // שתי נקודות זהות

    const nx = (-dy / length) * thickness;
    const ny = (dx / length) * thickness;

    return [
      { x: p1.x + nx, y: p1.y + ny },
      { x: p2.x + nx, y: p2.y + ny },
      { x: p2.x - nx, y: p2.y - ny },
      { x: p1.x - nx, y: p1.y - ny },
    ];
  }

  return convexHull(points);
}

// יצירת קונטור עבור קבוצת אחיזות לפי מזהה קלאסטר
export function createClusterOutline(holds: Hold[], clusterId: string): Vec2[] {
  const clusterHolds = holds.filter((hold) => hold.clusterId === clusterId);
  return createHoldOutline(clusterHolds);
}

// יצירת קונטור עבור כל האחיזות
export function createAllHoldsOutline(holds: Hold[]): Vec2[] {
  return createHoldOutline(holds);
}
