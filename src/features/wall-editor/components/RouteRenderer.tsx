// RouteRenderer - Renders routes with magnetic snap to walls

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { G, Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { EditorRoute, RoutePoint, Point, Selection } from '../types';

interface RouteRendererProps {
  /** Array of routes to render */
  routes: EditorRoute[];
  /** Currently building route (in progress) */
  buildingRoute?: EditorRoute | null;
  /** Current selection */
  selection?: Selection;
  /** Scale factor for point sizes */
  scale?: number;
  /** Callback when a route point is pressed */
  onPointPress?: (routeId: string, pointId: string) => void;
  /** Callback when a route is pressed */
  onRoutePress?: (routeId: string) => void;
  /** Room width for coordinate mapping */
  roomWidth: number;
  /** Room height for coordinate mapping */
  roomHeight: number;
  /** Container width in pixels */
  containerWidth: number;
  /** Container height in pixels */
  containerHeight: number;
  /** Show route names */
  showNames?: boolean;
  /** Show connecting lines between points */
  showLines?: boolean;
}

// Hold type colors
const POINT_TYPE_COLORS: Record<RoutePoint['type'], string> = {
  start: '#22C55E',  // Green
  hold: '#FFFFFF',   // White (will be tinted by route color)
  finish: '#EF4444', // Red
};

export default function RouteRenderer({
  routes,
  buildingRoute,
  selection,
  scale = 1,
  onPointPress,
  onRoutePress,
  roomWidth,
  roomHeight,
  containerWidth,
  containerHeight,
  showNames = true,
  showLines = true,
}: RouteRendererProps) {
  // Calculate scale factor to fit room in container
  const scaleX = containerWidth / roomWidth;
  const scaleY = containerHeight / roomHeight;
  const fitScale = Math.min(scaleX, scaleY);

  // Convert room coordinates to pixel coordinates
  const toPixels = (point: Point): Point => ({
    x: point.x * fitScale,
    y: point.y * fitScale,
  });

  // Check if a route/point is selected
  const isRouteSelected = (routeId: string) => 
    selection?.type === 'route' && selection.routeId === routeId;
  
  const isPointSelected = (routeId: string, pointId: string) =>
    selection?.type === 'point' && selection.routeId === routeId;

  // Create path string for connecting lines
  const createPathString = (points: RoutePoint[]): string => {
    if (points.length < 2) return '';
    
    const sortedPoints = [...points].sort((a, b) => a.order - b.order);
    const pixelPoints = sortedPoints.map(p => toPixels({ x: p.x, y: p.y }));
    
    let pathStr = `M ${pixelPoints[0].x} ${pixelPoints[0].y}`;
    for (let i = 1; i < pixelPoints.length; i++) {
      pathStr += ` L ${pixelPoints[i].x} ${pixelPoints[i].y}`;
    }
    
    return pathStr;
  };

  // Calculate center of route for label placement
  const getRouteCenter = (points: RoutePoint[]): Point => {
    if (points.length === 0) return { x: 0, y: 0 };
    
    const sum = points.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 }
    );
    
    return toPixels({
      x: sum.x / points.length,
      y: sum.y / points.length,
    });
  };

  // Render a single route
  const renderRoute = (route: EditorRoute, isBuilding: boolean = false) => {
    const isSelected = isRouteSelected(route.id);
    const sortedPoints = [...route.points].sort((a, b) => a.order - b.order);
    
    // Point radius adjusted for zoom
    const baseRadius = 12 / scale;
    const strokeWidth = 2 / scale;
    const lineWidth = 3 / scale;

    return (
      <G key={route.id}>
        {/* Connecting lines */}
        {showLines && sortedPoints.length >= 2 && (
          <Path
            d={createPathString(sortedPoints)}
            fill="none"
            stroke={route.color}
            strokeWidth={lineWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={isBuilding ? '8,4' : undefined}
            opacity={isBuilding ? 0.6 : 0.4}
          />
        )}

        {/* Route points */}
        {sortedPoints.map((point, index) => {
          const pixelPoint = toPixels({ x: point.x, y: point.y });
          const isPointSel = isPointSelected(route.id, point.id);
          
          // Determine point color based on type
          const baseColor = point.type === 'hold' ? route.color : POINT_TYPE_COLORS[point.type];
          
          return (
            <G key={point.id}>
              {/* Outer ring for selection */}
              {isPointSel && (
                <Circle
                  cx={pixelPoint.x}
                  cy={pixelPoint.y}
                  r={baseRadius + 4 / scale}
                  fill="none"
                  stroke="#00ff00"
                  strokeWidth={2 / scale}
                />
              )}
              
              {/* Main point */}
              <Circle
                cx={pixelPoint.x}
                cy={pixelPoint.y}
                r={baseRadius}
                fill={baseColor}
                stroke={isSelected ? '#ffffff' : '#000000'}
                strokeWidth={strokeWidth}
                onPress={() => onPointPress?.(route.id, point.id)}
              />
              
              {/* Point order number */}
              <SvgText
                x={pixelPoint.x}
                y={pixelPoint.y + 4 / scale}
                fontSize={10 / scale}
                fill={getContrastColor(baseColor)}
                textAnchor="middle"
                fontWeight="bold"
              >
                {index + 1}
              </SvgText>
            </G>
          );
        })}

        {/* Route name label */}
        {showNames && route.name && sortedPoints.length > 0 && !isBuilding && (
          <G>
            {/* Background for label */}
            <Circle
              cx={getRouteCenter(sortedPoints).x}
              cy={getRouteCenter(sortedPoints).y - 25 / scale}
              r={20 / scale}
              fill={route.color}
              opacity={0.8}
              onPress={() => onRoutePress?.(route.id)}
            />
            {/* Grade text */}
            <SvgText
              x={getRouteCenter(sortedPoints).x}
              y={getRouteCenter(sortedPoints).y - 21 / scale}
              fontSize={12 / scale}
              fill={getContrastColor(route.color)}
              textAnchor="middle"
              fontWeight="bold"
            >
              {route.grade}
            </SvgText>
          </G>
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
        {/* Existing routes */}
        {routes.map(route => renderRoute(route))}
        
        {/* Route being built */}
        {buildingRoute && buildingRoute.points.length > 0 && renderRoute(buildingRoute, true)}
      </G>
    </Svg>
  );
}

/**
 * Get contrasting text color for background
 */
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Parse RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

const styles = StyleSheet.create({
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
