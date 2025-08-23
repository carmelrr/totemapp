export const ROUTE_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#6366f1', // indigo
  '#84cc16', // lime
  '#f43f5e', // rose
  '#14b8a6', // teal
] as const;

export type RouteColor = typeof ROUTE_COLORS[number];

export function getRandomRouteColor(): RouteColor {
  return ROUTE_COLORS[Math.floor(Math.random() * ROUTE_COLORS.length)];
}

export function isValidRouteColor(color: string): color is RouteColor {
  return ROUTE_COLORS.includes(color as RouteColor);
}

export function getContrastTextColor(backgroundColor: string): string {
  // Simple contrast calculation - for production might want a more sophisticated version
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
