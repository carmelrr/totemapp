// EntranceArrowRenderer - Renders a polished entrance arrow indicator
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, G, Text as SvgText } from 'react-native-svg';
import { EntranceArrow } from '../types';

interface EntranceArrowRendererProps {
  arrow: EntranceArrow;
  scale: number;
  roomFitScale: number;
}

/**
 * Parse a hex color to r,g,b values
 */
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16) || 0,
    g: parseInt(clean.substring(2, 4), 16) || 0,
    b: parseInt(clean.substring(4, 6), 16) || 0,
  };
};

/**
 * Lighten a hex color by a factor (0-1)
 */
const lighten = (hex: string, factor: number): string => {
  const { r, g, b } = hexToRgb(hex);
  const lr = Math.min(255, Math.round(r + (255 - r) * factor));
  const lg = Math.min(255, Math.round(g + (255 - g) * factor));
  const lb = Math.min(255, Math.round(b + (255 - b) * factor));
  return `rgb(${lr},${lg},${lb})`;
};

/**
 * Darken a hex color by a factor (0-1)
 */
const darken = (hex: string, factor: number): string => {
  const { r, g, b } = hexToRgb(hex);
  const dr = Math.round(r * (1 - factor));
  const dg = Math.round(g * (1 - factor));
  const db = Math.round(b * (1 - factor));
  return `rgb(${dr},${dg},${db})`;
};

export default function EntranceArrowRenderer({ 
  arrow, 
  scale,
  roomFitScale,
}: EntranceArrowRendererProps) {
  if (!arrow.visible) return null;

  const s = roomFitScale; // shorthand for scale

  const startX = arrow.start.x * s;
  const startY = arrow.start.y * s;
  const endX = arrow.end.x * s;
  const endY = arrow.end.y * s;

  // Calculate arrow properties
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 2) return null; // too short to render

  const angle = Math.atan2(dy, dx);
  const nx = Math.cos(angle);
  const ny = Math.sin(angle);
  // perpendicular
  const px = -ny;
  const py = nx;

  const sw = arrow.strokeWidth * s;

  // ── Filled arrowhead (triangle) ──
  const headLen = Math.min(28 * s, length * 0.35);
  const headHalfW = headLen * 0.45;

  // Tip of the arrow
  const tipX = endX;
  const tipY = endY;

  // Base of the arrowhead (where it meets the shaft)
  const baseX = endX - nx * headLen;
  const baseY = endY - ny * headLen;

  // Two wing points of the arrowhead
  const wing1X = baseX + px * headHalfW;
  const wing1Y = baseY + py * headHalfW;
  const wing2X = baseX - px * headHalfW;
  const wing2Y = baseY - py * headHalfW;

  // Notch point (creates a concave back on the arrowhead)
  const notchDepth = headLen * 0.2;
  const notchX = baseX + nx * notchDepth;
  const notchY = baseY + ny * notchDepth;

  const headPath = `M ${tipX} ${tipY} L ${wing1X} ${wing1Y} L ${notchX} ${notchY} L ${wing2X} ${wing2Y} Z`;

  // ── Shaft path (ends at arrowhead base, not tip) ──
  // Gentle curve
  const curveFactor = length * 0.12;
  const cpX = startX + dx * 0.5 + px * curveFactor;
  const cpY = startY + dy * 0.5 + py * curveFactor;

  // Stop shaft slightly before arrowhead notch for clean join
  const shaftEndX = notchX;
  const shaftEndY = notchY;
  const shaftPath = `M ${startX} ${startY} Q ${cpX} ${cpY} ${shaftEndX} ${shaftEndY}`;

  // ── Decorative start marker ──
  const dotR = Math.max(5 * s, sw * 1.1);
  const ringR = dotR + 3 * s;

  // ── Gradient colors ──
  const colorLight = lighten(arrow.color, 0.3);
  const colorDark = darken(arrow.color, 0.25);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {/* Shaft gradient */}
          <LinearGradient id="shaftGrad" x1={startX} y1={startY} x2={endX} y2={endY} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colorLight} stopOpacity="0.85" />
            <Stop offset="1" stopColor={arrow.color} stopOpacity="1" />
          </LinearGradient>
          {/* Head gradient */}
          <LinearGradient id="headGrad" x1={baseX} y1={baseY} x2={tipX} y2={tipY} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={arrow.color} stopOpacity="1" />
            <Stop offset="1" stopColor={colorDark} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* ── Drop shadow layer ── */}
        <G opacity={0.2}>
          <Path
            d={shaftPath}
            stroke="#000"
            strokeWidth={sw + 5 * s}
            fill="none"
            strokeLinecap="round"
          />
          <Path d={headPath} fill="#000" />
        </G>

        {/* ── White outline for contrast ── */}
        <Path
          d={shaftPath}
          stroke="#fff"
          strokeWidth={sw + 3 * s}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={headPath}
          fill="none"
          stroke="#fff"
          strokeWidth={2.5 * s}
          strokeLinejoin="round"
        />

        {/* ── Main shaft with gradient ── */}
        <Path
          d={shaftPath}
          stroke="url(#shaftGrad)"
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
        />

        {/* ── Filled arrowhead with gradient ── */}
        <Path
          d={headPath}
          fill="url(#headGrad)"
          stroke={colorDark}
          strokeWidth={1 * s}
          strokeLinejoin="round"
        />

        {/* ── Arrowhead highlight (inner shine) ── */}
        <Path
          d={`M ${tipX} ${tipY} L ${wing1X} ${wing1Y} L ${notchX} ${notchY} Z`}
          fill={colorLight}
          opacity={0.2}
        />

        {/* ── Start marker: ring + filled dot ── */}
        <Circle
          cx={startX}
          cy={startY}
          r={ringR}
          fill="none"
          stroke="#fff"
          strokeWidth={2 * s}
          opacity={0.6}
        />
        <Circle
          cx={startX}
          cy={startY}
          r={dotR}
          fill={arrow.color}
          stroke="#fff"
          strokeWidth={1.5 * s}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({});
