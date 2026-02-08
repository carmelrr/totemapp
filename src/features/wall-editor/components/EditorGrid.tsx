// EditorGrid - Grid overlay component for the wall editor

import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Line, G, Text as SvgText } from 'react-native-svg';
import { GridConfig, DEFAULT_GRID_CONFIG } from '../types';

interface EditorGridProps {
  /** Width of the room in units */
  roomWidth: number;
  /** Height of the room in units */
  roomHeight: number;
  /** Grid configuration */
  config?: GridConfig;
  /** Container width in pixels */
  containerWidth: number;
  /** Container height in pixels */
  containerHeight: number;
  /** Current zoom scale */
  scale?: number;
  /** Show grid labels */
  showLabels?: boolean;
}

export default function EditorGrid({
  roomWidth,
  roomHeight,
  config = DEFAULT_GRID_CONFIG,
  containerWidth,
  containerHeight,
  scale = 1,
  showLabels = true,
}: EditorGridProps) {
  // Calculate the scale factor to fit room in container
  const scaleX = containerWidth / roomWidth;
  const scaleY = containerHeight / roomHeight;
  const fitScale = Math.min(scaleX, scaleY);
  
  // Effective dimensions
  const effectiveWidth = roomWidth * fitScale;
  const effectiveHeight = roomHeight * fitScale;
  
  // Cell size in pixels
  const cellSizePixels = config.cellSize * fitScale;
  
  // Generate grid lines
  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; isMajor: boolean }[] = [];
    
    // Vertical lines
    const numVertical = Math.ceil(roomWidth / config.cellSize);
    for (let i = 0; i <= numVertical; i++) {
      const x = i * cellSizePixels;
      const isMajor = config.showMajorLines && i % config.majorLineEvery === 0;
      lines.push({
        x1: x,
        y1: 0,
        x2: x,
        y2: effectiveHeight,
        isMajor,
      });
    }
    
    // Horizontal lines
    const numHorizontal = Math.ceil(roomHeight / config.cellSize);
    for (let i = 0; i <= numHorizontal; i++) {
      const y = i * cellSizePixels;
      const isMajor = config.showMajorLines && i % config.majorLineEvery === 0;
      lines.push({
        x1: 0,
        y1: y,
        x2: effectiveWidth,
        y2: y,
        isMajor,
      });
    }
    
    return lines;
  }, [roomWidth, roomHeight, config, cellSizePixels, effectiveWidth, effectiveHeight]);
  
  // Generate labels
  const labels = useMemo(() => {
    if (!showLabels || !config.showLabels) return [];
    
    const labelItems: { x: number; y: number; text: string; isVertical: boolean }[] = [];
    
    // X-axis labels (at bottom)
    const numVertical = Math.ceil(roomWidth / config.cellSize);
    for (let i = 0; i <= numVertical; i += config.majorLineEvery) {
      const x = i * cellSizePixels;
      labelItems.push({
        x,
        y: effectiveHeight + 15,
        text: `${i * config.cellSize}`,
        isVertical: false,
      });
    }
    
    // Y-axis labels (at left)
    const numHorizontal = Math.ceil(roomHeight / config.cellSize);
    for (let i = 0; i <= numHorizontal; i += config.majorLineEvery) {
      const y = i * cellSizePixels;
      labelItems.push({
        x: -5,
        y: y + 4,
        text: `${i * config.cellSize}`,
        isVertical: true,
      });
    }
    
    return labelItems;
  }, [roomWidth, roomHeight, config, cellSizePixels, effectiveWidth, effectiveHeight, showLabels]);

  return (
    <Svg
      width={containerWidth}
      height={containerHeight}
      viewBox={`0 0 ${containerWidth} ${containerHeight}`}
      style={styles.svg}
    >
      <G>
        {/* Minor grid lines */}
        {gridLines
          .filter(line => !line.isMajor)
          .map((line, index) => (
            <Line
              key={`minor-${index}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={config.minorLineColor}
              strokeWidth={0.5 / scale}
              opacity={0.3}
            />
          ))}
        
        {/* Major grid lines */}
        {gridLines
          .filter(line => line.isMajor)
          .map((line, index) => (
            <Line
              key={`major-${index}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={config.majorLineColor}
              strokeWidth={1 / scale}
              opacity={0.5}
            />
          ))}
        
        {/* Labels */}
        {labels.map((label, index) => (
          <SvgText
            key={`label-${index}`}
            x={label.x}
            y={label.y}
            fontSize={10 / scale}
            fill="#888"
            textAnchor={label.isVertical ? 'end' : 'middle'}
          >
            {label.text}
          </SvgText>
        ))}
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
