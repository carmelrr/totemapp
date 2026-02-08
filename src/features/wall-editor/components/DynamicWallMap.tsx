// DynamicWallMap - Replaces static SVG map with editor-built walls

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Polyline, Polygon, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { Room, Wall, Mat, Point, Sector, TextLabel } from '../types';

interface DynamicWallMapProps {
  /** The room data to render */
  room: Room;
  /** Width of the view */
  width: number | string;
  /** Height of the view */
  height?: number | string;
  /** Preserve aspect ratio setting */
  preserveAspectRatio?: string;
  /** Optional style */
  style?: any;
  /** Show sector overlays (borders) */
  showSectors?: boolean;
  /** Show sector labels */
  showSectorLabels?: boolean;
  /** Show text labels */
  showTextLabels?: boolean;
}

/**
 * DynamicWallMap - A component that renders walls from the editor
 * instead of using a static SVG file.
 * 
 * This component can be used as a drop-in replacement for WallMapSVG
 * when a room has been configured via the editor.
 */
export default React.memo(function DynamicWallMap({
  room,
  width = '100%',
  height,
  preserveAspectRatio = 'xMidYMid meet',
  style,
  showSectors = false,
  showSectorLabels = true,
  showTextLabels = true,
}: DynamicWallMapProps) {
  // Calculate viewBox from room dimensions
  const viewBox = `0 0 ${room.width} ${room.height}`;
  
  // Render mat polygons
  const renderMat = (mat: Mat) => {
    if (mat.points.length < 3) return null;
    
    const pointsStr = mat.points
      .map(p => `${p.x},${p.y}`)
      .join(' ');
    
    return (
      <Polygon
        key={mat.id}
        points={pointsStr}
        fill={mat.color}
        fillOpacity={mat.opacity}
        stroke="none"
      />
    );
  };
  
  // Render wall polylines/polygons
  const renderWall = (wall: Wall) => {
    const pointsStr = wall.points
      .map(p => `${p.x},${p.y}`)
      .join(' ');
    
    if (wall.isClosed && wall.points.length > 2) {
      return (
        <Polygon
          key={wall.id}
          points={pointsStr}
          fill={wall.fillColor || 'transparent'}
          fillOpacity={wall.fillOpacity || 0.2}
          stroke={wall.color}
          strokeWidth={wall.strokeWidth}
          strokeLinejoin="round"
        />
      );
    }
    
    return (
      <Polyline
        key={wall.id}
        points={pointsStr}
        fill="none"
        stroke={wall.color}
        strokeWidth={wall.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  };
  
  return (
    <Svg
      viewBox={viewBox}
      width={width}
      height={height}
      preserveAspectRatio={preserveAspectRatio}
      style={style}
    >
      {/* Background */}
      <Rect
        x={0}
        y={0}
        width={room.width}
        height={room.height}
        fill={room.backgroundColor}
      />
      
      {/* Mats layer (below walls) */}
      <G>
        {room.mats?.map(renderMat)}
      </G>
      
      {/* Walls layer */}
      <G>
        {room.walls.map(renderWall)}
      </G>
      
      {/* Sectors layer (optional overlay) */}
      {showSectors && room.sectors && (
        <G>
          {room.sectors.map(sector => (
            <Rect
              key={sector.id}
              x={sector.bounds.x}
              y={sector.bounds.y}
              width={sector.bounds.width}
              height={sector.bounds.height}
              fill={sector.color}
              fillOpacity={0.1}
              stroke={sector.color}
              strokeWidth={2}
              strokeDasharray="8,4"
            />
          ))}
        </G>
      )}
      
      {/* Sector labels layer - rendered in SVG so they appear in editor preview */}
      {showSectorLabels && room.sectors && room.sectors.length > 0 && (
        <G>
          {room.sectors.map(sector => {
            const labelOpacity = sector.labelOpacity ?? 1;
            const labelOffset = sector.labelOffset || { x: 0, y: 0 };
            const fontSize = sector.labelFontSize || 14;
            
            // Label center is at sector center + offset
            const labelX = sector.bounds.x + sector.bounds.width / 2 + labelOffset.x;
            const labelY = sector.bounds.y + sector.bounds.height / 2 + labelOffset.y;
            
            // Estimate pill size based on text and font size
            const pillWidth = Math.max(sector.name.length * fontSize * 0.7, fontSize * 2) + 16;
            const pillHeight = fontSize + 12;
            
            return (
              <G key={`label-${sector.id}`} opacity={labelOpacity}>
                {/* Background pill */}
                <Rect
                  x={labelX - pillWidth / 2}
                  y={labelY - pillHeight / 2}
                  width={pillWidth}
                  height={pillHeight}
                  rx={pillHeight / 2}
                  ry={pillHeight / 2}
                  fill={sector.color}
                />
                {/* Label text */}
                <SvgText
                  x={labelX}
                  y={labelY + fontSize * 0.35}
                  textAnchor="middle"
                  fontSize={fontSize}
                  fontWeight="700"
                  fill="#fff"
                >
                  {sector.name}
                </SvgText>
              </G>
            );
          })}
        </G>
      )}
      
      {/* Text labels layer - on top of everything */}
      {showTextLabels && room.textLabels && room.textLabels.length > 0 && (
        <G>
          {room.textLabels.map(label => {
            const padding = label.padding || 8;
            const borderRadius = label.borderRadius || 8;
            
            // Estimate text width based on font size and text length
            const estimatedWidth = label.text.length * label.fontSize * 0.6;
            const bgWidth = estimatedWidth + padding * 2;
            const bgHeight = label.fontSize + padding * 2;
            
            return (
              <G key={`text-${label.id}`} opacity={label.opacity}>
                {/* Background (if enabled) */}
                {label.backgroundColor && (
                  <Rect
                    x={label.position.x - bgWidth / 2}
                    y={label.position.y - bgHeight / 2}
                    width={bgWidth}
                    height={bgHeight}
                    rx={borderRadius}
                    ry={borderRadius}
                    fill={label.backgroundColor}
                    fillOpacity={label.backgroundOpacity ?? 0.8}
                  />
                )}
                {/* Text */}
                <SvgText
                  x={label.position.x}
                  y={label.position.y + label.fontSize * 0.35}
                  textAnchor="middle"
                  fontSize={label.fontSize}
                  fontWeight={label.fontWeight || '700'}
                  fill={label.color}
                >
                  {label.text}
                </SvgText>
              </G>
            );
          })}
        </G>
      )}
    </Svg>
  );
});

/**
 * Props for the combined map component that can use either
 * static SVG or dynamic room data
 */
interface CombinedWallMapProps {
  /** Room data (if using dynamic map) */
  room?: Room | null;
  /** Static SVG component (if using legacy mode) */
  StaticMap?: React.ComponentType<any>;
  /** Width of the view */
  width: number | string;
  /** Height of the view */
  height?: number | string;
  /** Whether to use static SVG (legacy mode) */
  useLegacy?: boolean;
  /** Preserve aspect ratio setting */
  preserveAspectRatio?: string;
}

/**
 * CombinedWallMap - Wrapper that switches between static SVG and dynamic map
 * 
 * This allows gradual migration from SVG-based maps to editor-built maps
 * while maintaining backward compatibility.
 */
export function CombinedWallMap({
  room,
  StaticMap,
  width,
  height,
  useLegacy = false,
  preserveAspectRatio = 'xMidYMid meet',
}: CombinedWallMapProps) {
  // Use dynamic map if room is available and not in legacy mode
  if (!useLegacy && room && room.walls.length > 0) {
    return (
      <DynamicWallMap
        room={room}
        width={width}
        height={height}
        preserveAspectRatio={preserveAspectRatio}
      />
    );
  }
  
  // Fall back to static SVG
  if (StaticMap) {
    return (
      <StaticMap
        width={width}
        height={height}
        preserveAspectRatio={preserveAspectRatio}
      />
    );
  }
  
  // No map available - render placeholder
  const placeholderWidth = typeof width === 'number' ? width : parseInt(String(width), 10) || 300;
  const placeholderHeight = typeof height === 'number' ? height : parseInt(String(height), 10) || 200;
  
  return (
    <View style={[styles.placeholder, { width: placeholderWidth, height: placeholderHeight }]}>
      <Svg viewBox="0 0 100 100" width="100%" height="100%">
        <Rect x={0} y={0} width={100} height={100} fill="#1a1a2e" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#1a1a2e',
  },
});
