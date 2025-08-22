export function getScreenCoords(route, scale, translateX, translateY, mapWidth, mapHeight) {
  // Check if route has required properties
  if (!route || typeof route.x !== 'number' || typeof route.y !== 'number') {
    return { screenX: 0, screenY: 0 };
  }
  
  // תמיכה אוטומטית בשני פורמטים: יחס (0-1) או פיקסלים
  const ORIGINAL_MAP_WIDTH = 2560;
  const ORIGINAL_MAP_HEIGHT = 1600;
  
  const xNorm = route.x > 2 ? route.x / ORIGINAL_MAP_WIDTH : route.x;
  const yNorm = route.y > 2 ? route.y / ORIGINAL_MAP_HEIGHT : route.y;
  
  // חישוב המיקום היחסי על המפה (בלי טרנספורמציות)
  const relativeX = xNorm * mapWidth;
  const relativeY = yNorm * mapHeight;

  // המיקום על המסך עם הטרנספורמציות
  // הטרנספורמציות מוחלות על הקונטיינר, לכן נחשב איך זה משפיע על המיקום
  const centerX = mapWidth / 2;
  const centerY = mapHeight / 2;
  
  // המיקום יחסית למרכז המפה
  const offsetX = relativeX - centerX;
  const offsetY = relativeY - centerY;
  
  // הטרנספורמציות: תחילה scale, אחר כך translate
  const scaledX = offsetX * scale;
  const scaledY = offsetY * scale;
  
  // המיקום הסופי על המסך
  const screenX = centerX + scaledX + translateX;
  const screenY = centerY + scaledY + translateY;

  return { screenX, screenY };
}

export function isRouteVisibleOnScreen(route, scale, translateX, translateY, mapWidth, mapHeight, circleRadius = 15) {
  if (!route || typeof route.x !== 'number' || typeof route.y !== 'number') {
    return false;
  }
  
  const { screenX, screenY } = getScreenCoords(route, scale, translateX, translateY, mapWidth, mapHeight);
  
  // בדוק אם העיגול נראה במסך (עם מרווח בטחון)
  const isVisible = (
    screenX >= -circleRadius &&
    screenX <= mapWidth + circleRadius &&
    screenY >= -circleRadius &&
    screenY <= mapHeight + circleRadius
  );
  
  return isVisible;
}

export function toRelativeCoords(x, y, mapWidth, mapHeight) {
  // המר את הקואורדינטות למספר בין 0 ל-1
  return {
    x: (x / mapWidth),
    y: (y / mapHeight)
  };
}
