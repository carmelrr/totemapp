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
