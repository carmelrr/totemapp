// MatRenderer - Renders mat/floor layers on the canvas (below walls)

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { G, Polygon, Line } from 'react-native-svg';
import { Mat, Point, Selection } from '../types';

interface MatRendererProps {
  /** Array of mats to render */
  mats: Mat[];
  /** Currently building mat (in progress) */
  buildingMat?: Mat | null;
  /** Current selection */
  selection?: Selection;
  /** Scale factor for point sizes */
  scale?: number;
  /** Room width for coordinate mapping */
  roomWidth: number;
  /** Room height for coordinate mapping */
  roomHeight: number;
  /** Container width in pixels */
  containerWidth: number;
  /** Container height in pixels */
  containerHeight: number;
}

export default function MatRenderer({
  mats,
  buildingMat,
  selection,
  scale = 1,
  roomWidth,
  roomHeight,
  containerWidth,
  containerHeight,
}: MatRendererProps) {
  // Calculate scale factor to fit room in container
  const scaleX = containerWidth / roomWidth;
  const scaleY = containerHeight / roomHeight;
  const fitScale = Math.min(scaleX, scaleY);

  // Convert room coordinates to pixel coordinates
  const toPixels = (point: Point): Point => ({
    x: point.x * fitScale,
    y: point.y * fitScale,
  });

  // Build polygon points string
  const pointsToString = (points: Point[]): string => {
    return points.map(p => {
      const px = toPixels(p);
      return `${px.x},${px.y}`;
    }).join(' ');
  };

  // Render a single mat
  const renderMat = (mat: Mat, isBuilding: boolean = false) => {
    if (mat.points.length < 2) return null;
    
    const pixelPoints = mat.points.map(toPixels);
    const pointsStr = pointsToString(mat.points);
    const strokeWidth = 2 / scale;

    // Get first and last points for preview closing line
    const firstPixelPoint = pixelPoints[0];
    const lastPixelPoint = pixelPoints[pixelPoints.length - 1];
    const showClosingPreview = isBuilding && mat.points.length >= 3;

    return (
      <G key={mat.id}>
        {/* Mat polygon fill */}
        {mat.points.length >= 3 && (
          <Polygon
            points={pointsStr}
            fill={mat.color}
            fillOpacity={isBuilding ? mat.opacity * 0.5 : mat.opacity}
            stroke={isBuilding ? '#ffff00' : mat.color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeDasharray={isBuilding ? '5,5' : undefined}
          />
        )}

        {/* Preview closing line - shows where polygon will close when building */}
        {showClosingPreview && firstPixelPoint && lastPixelPoint && (
          <Line
            x1={lastPixelPoint.x}
            y1={lastPixelPoint.y}
            x2={firstPixelPoint.x}
            y2={firstPixelPoint.y}
            stroke="#F59E0B"
            strokeWidth={strokeWidth}
            strokeDasharray="8,4"
            strokeOpacity={0.6}
          />
        )}
      </G>
    );
  };

  return (
    <Svg
      width={containerWidth}
      height={containerHeight}
      viewBox={`0 0 ${containerWidth} ${containerHeight}`}
      style={styles.svg}
    >
      <G>
        {/* Existing mats */}
        {mats.map(mat => renderMat(mat))}
        
        {/* Mat being built */}
        {buildingMat && buildingMat.points.length > 0 && renderMat(buildingMat, true)}
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
