// features/routes/symmetry.ts
import { Vec2 } from "@/types/geometry";
import { Hold } from "./types";

// השקפה של נקודה על קו שרירותי
export function reflectPointOverLine(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ab2 = ab.x * ab.x + ab.y * ab.y;

  if (ab2 === 0) return p; // הקו הוא נקודה

  const dot = ap.x * ab.x + ap.y * ab.y;
  const t = dot / ab2;
  const proj = { x: a.x + ab.x * t, y: a.y + ab.y * t };

  return { x: 2 * proj.x - p.x, y: 2 * proj.y - p.y };
}

// השקפה על ציר אנכי
export function reflectPointVertical(p: Vec2, centerX: number): Vec2 {
  return { x: 2 * centerX - p.x, y: p.y };
}

// השקפה על ציר אופקי
export function reflectPointHorizontal(p: Vec2, centerY: number): Vec2 {
  return { x: p.x, y: 2 * centerY - p.y };
}

// השקפה על נקודת מרכז
export function reflectPointOverCenter(p: Vec2, center: Vec2): Vec2 {
  return {
    x: 2 * center.x - p.x,
    y: 2 * center.y - p.y,
  };
}

// החלת סימטריה על אחיזה
export function applySymmetryToHold(
  hold: Hold,
  symmetryType: "vertical" | "horizontal" | "line" | "center",
  symmetryParams: any,
): Hold {
  const newId = `${hold.id}_mirrored_${Date.now()}`;
  let newPosition: Vec2;

  switch (symmetryType) {
    case "vertical":
      newPosition = reflectPointVertical(
        { x: hold.x, y: hold.y },
        symmetryParams.centerX,
      );
      break;

    case "horizontal":
      newPosition = reflectPointHorizontal(
        { x: hold.x, y: hold.y },
        symmetryParams.centerY,
      );
      break;

    case "line":
      newPosition = reflectPointOverLine(
        { x: hold.x, y: hold.y },
        symmetryParams.line.p1,
        symmetryParams.line.p2,
      );
      break;

    case "center":
      newPosition = reflectPointOverCenter(
        { x: hold.x, y: hold.y },
        symmetryParams.center,
      );
      break;

    default:
      newPosition = { x: hold.x, y: hold.y };
  }

  return {
    ...hold,
    id: newId,
    x: newPosition.x,
    y: newPosition.y,
  };
}

// החלת סימטריה על מערך של אחיזות
export function applySymmetryToHolds(
  holds: Hold[],
  symmetryType: "vertical" | "horizontal" | "line" | "center",
  symmetryParams: any,
): Hold[] {
  return holds.map((hold) =>
    applySymmetryToHold(hold, symmetryType, symmetryParams),
  );
}
