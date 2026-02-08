// WallRenderer - Renders walls/sectors on the canvas

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { G, Polyline, Circle, Polygon, Line } from 'react-native-svg';
import { Wall, Point, Selection } from '../types';

interface WallRendererProps {
  /** Array of walls to render */
  walls: Wall[];
  /** Currently building wall (in progress) */
  buildingWall?: Wall | null;
  /** Current selection */
  selection?: Selection;
  /** Scale factor for point sizes */
  scale?: number;
  /** Callback when a wall point is pressed */
  onPointPress?: (wallId: string, pointIndex: number) => void;
  /** Callback when a wall is pressed */
  onWallPress?: (wallId: string) => void;
  /** Room width for coordinate mapping */
  roomWidth: number;
  /** Room height for coordinate mapping */
  roomHeight: number;
  /** Container width in pixels */
  containerWidth: number;
  /** Container height in pixels */
  containerHeight: number;
}

export default function WallRenderer({
  walls,
  buildingWall,
  selection,
  scale = 1,
  onPointPress,
  onWallPress,
  roomWidth,
  roomHeight,
  containerWidth,
  containerHeight,
}: WallRendererProps) {
  // Calculate scale factor to fit room in container
  const scaleX = containerWidth / roomWidth;
  const scaleY = containerHeight / roomHeight;
  const fitScale = Math.min(scaleX, scaleY);

  // Convert room coordinates to pixel coordinates
  const toPixels = (point: Point): Point => ({
    x: point.x * fitScale,
    y: point.y * fitScale,
  });

  // Build polyline points string
  const pointsToString = (points: Point[]): string => {
    return points.map(p => {
      const px = toPixels(p);
      return `${px.x},${px.y}`;
    }).join(' ');
  };

  // Check if a wall/point is selected
  const isWallSelected = (wallId: string) => 
    selection?.type === 'wall' && selection.wallId === wallId;
  
  const isPointSelected = (wallId: string, pointIndex: number) =>
    selection?.type === 'point' && 
    selection.wallId === wallId && 
    selection.pointIndex === pointIndex;

  // Render a single wall
  const renderWall = (wall: Wall, isBuilding: boolean = false) => {
    const isSelected = isWallSelected(wall.id);
    const pixelPoints = wall.points.map(toPixels);
    const pointsStr = pointsToString(wall.points);
    
    // Point radius adjusted for zoom
    const pointRadius = (isSelected ? 10 : 6) / scale;
    const strokeWidth = (wall.strokeWidth || 3) / scale;

    // Get first and last points for preview closing line
    const firstPixelPoint = pixelPoints[0];
    const lastPixelPoint = pixelPoints[pixelPoints.length - 1];
    const showClosingPreview = isBuilding && wall.points.length >= 3;

    return (
      <G key={wall.id}>
        {/* Wall shape - polygon if closed, polyline if open */}
        {wall.isClosed && wall.points.length > 2 ? (
          <Polygon
            points={pointsStr}
            fill={wall.fillColor || 'transparent'}
            fillOpacity={wall.fillOpacity || 0.2}
            stroke={isSelected ? '#00ff00' : wall.color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            onPress={() => onWallPress?.(wall.id)}
          />
        ) : (
          <Polyline
            points={pointsStr}
            fill="none"
            stroke={isBuilding ? '#ffff00' : isSelected ? '#00ff00' : wall.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={isBuilding ? '5,5' : undefined}
            onPress={() => onWallPress?.(wall.id)}
          />
        )}

        {/* Preview closing line - shows where polygon will close */}
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

        {/* Control points */}
        {pixelPoints.map((point, index) => {
          const isPointSel = isPointSelected(wall.id, index);
          const isFirst = index === 0;
          const isLast = index === wall.points.length - 1;
          
          return (
            <Circle
              key={`${wall.id}-point-${index}`}
              cx={point.x}
              cy={point.y}
              r={pointRadius}
              fill={
                isPointSel
                  ? '#00ff00'
                  : isFirst
                  ? '#22C55E'
                  : isLast
                  ? '#EF4444'
                  : wall.color
              }
              stroke={isPointSel ? '#ffffff' : '#000000'}
              strokeWidth={1 / scale}
              onPress={() => onPointPress?.(wall.id, index)}
            />
          );
        })}
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
        {/* Existing walls */}
        {walls.map(wall => renderWall(wall))}
        
        {/* Wall being built */}
        {buildingWall && buildingWall.points.length > 0 && renderWall(buildingWall, true)}
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
