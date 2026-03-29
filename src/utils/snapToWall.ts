/**
 * Snap-to-wall utility
 * 
 * Given a point in image coordinates and a Room with walls,
 * finds the nearest point on any wall polyline/polygon and returns it.
 * This ensures routes are aligned precisely on wall surfaces.
 */

import type { Room, Wall, Point } from '@/features/wall-editor/types';

interface SnapResult {
  /** Snapped point in image coordinates */
  xImg: number;
  yImg: number;
  /** Distance from original point to snapped point (in image coords) */
  distance: number;
  /** The wall that was snapped to */
  wallId: string;
}

/**
 * Find the closest point on a line segment (A→B) to a given point P.
 * Returns the projected point and the squared distance.
 */
function closestPointOnSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): { x: number; y: number; distSq: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Segment is a point
    const distSq = (px - ax) ** 2 + (py - ay) ** 2;
    return { x: ax, y: ay, distSq };
  }

  // Project P onto the line defined by A→B, clamped to [0,1]
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  const distSq = (px - closestX) ** 2 + (py - closestY) ** 2;

  return { x: closestX, y: closestY, distSq };
}

/**
 * Snap a point (in image coordinates) to the nearest wall edge.
 * 
 * Walls are defined in room coordinates, so we convert between
 * image coords and room coords using the provided dimensions.
 * 
 * @param xImg - X position in image coordinates
 * @param yImg - Y position in image coordinates
 * @param imgW - Image width in pixels
 * @param imgH - Image height in pixels
 * @param room - The Room object containing walls
 * @param maxSnapDistance - Maximum snap distance in image coords (optional, default Infinity)
 * @returns The snapped position in image coordinates, or the original if no wall is nearby
 */
export function snapToNearestWall(
  xImg: number,
  yImg: number,
  imgW: number,
  imgH: number,
  room: Room,
  maxSnapDistance: number = Infinity,
): { xImg: number; yImg: number; snapped: boolean } {
  if (!room.walls || room.walls.length === 0 || imgW === 0 || imgH === 0) {
    return { xImg, yImg, snapped: false };
  }

  // Convert image coords to room coords
  const scaleX = room.width / imgW;
  const scaleY = room.height / imgH;
  const roomX = xImg * scaleX;
  const roomY = yImg * scaleY;

  let bestDistSq = Infinity;
  let bestX = roomX;
  let bestY = roomY;

  for (const wall of room.walls) {
    if (wall.points.length < 2) continue;

    const points = wall.points;
    const segmentCount = wall.isClosed ? points.length : points.length - 1;

    for (let i = 0; i < segmentCount; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];

      const result = closestPointOnSegment(roomX, roomY, a.x, a.y, b.x, b.y);

      if (result.distSq < bestDistSq) {
        bestDistSq = result.distSq;
        bestX = result.x;
        bestY = result.y;
      }
    }
  }

  // Convert back to image coordinates
  const snappedXImg = bestX / scaleX;
  const snappedYImg = bestY / scaleY;

  // Check distance in image coordinates
  const distInImg = Math.sqrt(
    (snappedXImg - xImg) ** 2 + (snappedYImg - yImg) ** 2,
  );

  if (distInImg <= maxSnapDistance) {
    return { xImg: snappedXImg, yImg: snappedYImg, snapped: true };
  }

  return { xImg, yImg, snapped: false };
}

/**
 * Snap normalized coordinates (0-1) to the nearest wall edge.
 * 
 * This is a convenience wrapper for when you have normalized route
 * coordinates and want to snap them.
 * 
 * @param xNorm - Normalized X (0-1)
 * @param yNorm - Normalized Y (0-1)
 * @param room - The Room object containing walls
 * @returns Snapped normalized coordinates
 */
export function snapNormToNearestWall(
  xNorm: number,
  yNorm: number,
  room: Room,
): { xNorm: number; yNorm: number; snapped: boolean } {
  if (!room.walls || room.walls.length === 0) {
    return { xNorm, yNorm, snapped: false };
  }

  // Convert norm to room coords directly
  const roomX = xNorm * room.width;
  const roomY = yNorm * room.height;

  let bestDistSq = Infinity;
  let bestX = roomX;
  let bestY = roomY;

  for (const wall of room.walls) {
    if (wall.points.length < 2) continue;

    const points = wall.points;
    const segmentCount = wall.isClosed ? points.length : points.length - 1;

    for (let i = 0; i < segmentCount; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];

      const result = closestPointOnSegment(roomX, roomY, a.x, a.y, b.x, b.y);

      if (result.distSq < bestDistSq) {
        bestDistSq = result.distSq;
        bestX = result.x;
        bestY = result.y;
      }
    }
  }

  // Convert back to normalized
  const snappedXNorm = Math.max(0, Math.min(1, bestX / room.width));
  const snappedYNorm = Math.max(0, Math.min(1, bestY / room.height));

  return { xNorm: snappedXNorm, yNorm: snappedYNorm, snapped: true };
}

/**
 * Find the closest wall segment to a point in room coords.
 * Returns the wall index, segment index, and the parametric t along that segment.
 */
function findClosestWallSegment(
  roomX: number,
  roomY: number,
  room: Room,
): { wallIdx: number; segIdx: number; t: number; distSq: number } | null {
  let bestDistSq = Infinity;
  let bestWallIdx = -1;
  let bestSegIdx = -1;
  let bestT = 0;

  for (let wi = 0; wi < room.walls.length; wi++) {
    const wall = room.walls[wi];
    if (wall.points.length < 2) continue;
    const segmentCount = wall.isClosed ? wall.points.length : wall.points.length - 1;
    for (let si = 0; si < segmentCount; si++) {
      const a = wall.points[si];
      const b = wall.points[(si + 1) % wall.points.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      let t = 0;
      if (lenSq > 0) {
        t = Math.max(0, Math.min(1, ((roomX - a.x) * dx + (roomY - a.y) * dy) / lenSq));
      }
      const cx = a.x + t * dx;
      const cy = a.y + t * dy;
      const dSq = (roomX - cx) ** 2 + (roomY - cy) ** 2;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestWallIdx = wi;
        bestSegIdx = si;
        bestT = t;
      }
    }
  }

  if (bestWallIdx < 0) return null;
  return { wallIdx: bestWallIdx, segIdx: bestSegIdx, t: bestT, distSq: bestDistSq };
}

function segmentLength(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/**
 * Distribute N points evenly along the wall polyline between two extreme
 * positions (given in normalized 0-1 coords).
 *
 * Algorithm:
 * 1. Snap each extreme to the nearest wall segment.
 * 2. If both extremes land on the same wall, walk from A to B along the polyline.
 *    If they land on different walls, fall back to snapping a straight-line distribution.
 * 3. Compute cumulative arc lengths along the polyline path.
 * 4. Place each of the N points at equal arc-length intervals.
 */
export function distributeAlongWallPolyline(
  extremeA: { xNorm: number; yNorm: number },
  extremeB: { xNorm: number; yNorm: number },
  count: number,
  room: Room,
): { xNorm: number; yNorm: number }[] {
  if (count < 2 || !room.walls || room.walls.length === 0) {
    return Array.from({ length: count }, (_, i) => {
      const f = count > 1 ? i / (count - 1) : 0;
      return {
        xNorm: extremeA.xNorm + f * (extremeB.xNorm - extremeA.xNorm),
        yNorm: extremeA.yNorm + f * (extremeB.yNorm - extremeA.yNorm),
      };
    });
  }

  const aRoomX = extremeA.xNorm * room.width;
  const aRoomY = extremeA.yNorm * room.height;
  const bRoomX = extremeB.xNorm * room.width;
  const bRoomY = extremeB.yNorm * room.height;

  const snapA = findClosestWallSegment(aRoomX, aRoomY, room);
  const snapB = findClosestWallSegment(bRoomX, bRoomY, room);

  if (!snapA || !snapB || snapA.wallIdx !== snapB.wallIdx) {
    // Different walls or no walls — snap each straight-line point individually
    return Array.from({ length: count }, (_, i) => {
      const f = count > 1 ? i / (count - 1) : 0;
      const x = extremeA.xNorm + f * (extremeB.xNorm - extremeA.xNorm);
      const y = extremeA.yNorm + f * (extremeB.yNorm - extremeA.yNorm);
      const snapped = snapNormToNearestWall(x, y, room);
      return { xNorm: snapped.xNorm, yNorm: snapped.yNorm };
    });
  }

  // Both extremes are on the same wall — walk the polyline
  const wall = room.walls[snapA.wallIdx];
  const pts = wall.points;
  const segCount = wall.isClosed ? pts.length : pts.length - 1;

  // Build ordered path from A to B along the wall
  // A is on segment snapA.segIdx at parameter snapA.t
  // B is on segment snapB.segIdx at parameter snapB.t
  // We need to determine direction: walk A→B by increasing segment index
  // For closed walls, we pick the shorter direction.

  const pointOnSeg = (segIdx: number, t: number): Point => {
    const a = pts[segIdx];
    const b = pts[(segIdx + 1) % pts.length];
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  };

  const startPt = pointOnSeg(snapA.segIdx, snapA.t);
  const endPt = pointOnSeg(snapB.segIdx, snapB.t);

  // Build path points in forward direction (increasing segment index)
  const buildPath = (fromSeg: number, fromT: number, toSeg: number, toT: number, forward: boolean): Point[] => {
    const path: Point[] = [];
    const start = pointOnSeg(fromSeg, fromT);
    path.push(start);

    if (fromSeg === toSeg && ((forward && fromT <= toT) || (!forward && fromT >= toT))) {
      // Same segment, correct direction
      path.push(pointOnSeg(toSeg, toT));
      return path;
    }

    let seg = fromSeg;
    if (forward) {
      // Add end of current segment
      path.push(pts[(seg + 1) % pts.length]);
      seg = (seg + 1) % segCount;
      // Walk forward until we reach toSeg
      let safety = 0;
      while (seg !== toSeg && safety < segCount + 1) {
        path.push(pts[(seg + 1) % pts.length]);
        seg = (seg + 1) % segCount;
        safety++;
      }
      // Add the end point on toSeg
      path.push(pointOnSeg(toSeg, toT));
    } else {
      // Add start of current segment
      path.push(pts[seg]);
      seg = (seg - 1 + segCount) % segCount;
      // Walk backward
      let safety = 0;
      while (seg !== toSeg && safety < segCount + 1) {
        path.push(pts[seg]);
        seg = (seg - 1 + segCount) % segCount;
        safety++;
      }
      path.push(pointOnSeg(toSeg, toT));
    }
    return path;
  };

  const pathForward = buildPath(snapA.segIdx, snapA.t, snapB.segIdx, snapB.t, true);
  let pathPoints = pathForward;

  if (wall.isClosed) {
    const pathBackward = buildPath(snapA.segIdx, snapA.t, snapB.segIdx, snapB.t, false);
    // Pick shorter path
    const lengthOf = (p: Point[]): number => {
      let len = 0;
      for (let i = 1; i < p.length; i++) len += segmentLength(p[i - 1], p[i]);
      return len;
    };
    if (lengthOf(pathBackward) < lengthOf(pathForward)) {
      pathPoints = pathBackward;
    }
  }

  // Compute cumulative arc lengths
  const arcLengths: number[] = [0];
  for (let i = 1; i < pathPoints.length; i++) {
    arcLengths.push(arcLengths[i - 1] + segmentLength(pathPoints[i - 1], pathPoints[i]));
  }
  const totalLength = arcLengths[arcLengths.length - 1];

  if (totalLength < 0.0001) {
    // Degenerate — all points are the same
    return Array(count).fill({ xNorm: extremeA.xNorm, yNorm: extremeA.yNorm });
  }

  // Distribute count points at equal arc-length intervals
  const result: { xNorm: number; yNorm: number }[] = [];
  for (let i = 0; i < count; i++) {
    const targetLen = (i / (count - 1)) * totalLength;
    // Find the segment of the path this falls on
    let segI = 0;
    while (segI < arcLengths.length - 2 && arcLengths[segI + 1] < targetLen) {
      segI++;
    }
    const segStart = arcLengths[segI];
    const segEnd = arcLengths[segI + 1];
    const segLen = segEnd - segStart;
    const t = segLen > 0 ? (targetLen - segStart) / segLen : 0;
    const px = pathPoints[segI].x + t * (pathPoints[segI + 1].x - pathPoints[segI].x);
    const py = pathPoints[segI].y + t * (pathPoints[segI + 1].y - pathPoints[segI].y);
    result.push({
      xNorm: Math.max(0, Math.min(1, px / room.width)),
      yNorm: Math.max(0, Math.min(1, py / room.height)),
    });
  }

  return result;
}
