export const validateAspectRatio = (width, height) => {
  const ratio = width / height;
  const target = 4 / 3;
  const tolerance = 0.01;
  
  return Math.abs(ratio - target) < tolerance;
};

export const normalizeHoldPosition = (x, y, r, imageWidth, imageHeight) => {
  return {
    x: x / imageWidth,
    y: y / imageHeight,
    r: r / Math.min(imageWidth, imageHeight)
  };
};

export const denormalizeHoldPosition = (normalizedHold, imageWidth, imageHeight) => {
  return {
    x: normalizedHold.x * imageWidth,
    y: normalizedHold.y * imageHeight,
    r: normalizedHold.r * Math.min(imageWidth, imageHeight)
  };
};

export const validateHoldPosition = (x, y, r) => {
  return (
    x >= 0 && x <= 1 &&
    y >= 0 && y <= 1 &&
    r >= 0 && r <= 0.5
  );
};

export const validateRouteData = (routeData) => {
  const { name, grade, holds } = routeData;
  
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Route name is required' };
  }
  
  if (!grade || grade.trim().length === 0) {
    return { valid: false, error: 'Grade is required' };
  }
  
  if (!holds || holds.length === 0) {
    return { valid: false, error: 'At least one hold is required' };
  }
  
  // Check for required hold types
  const hasStart = holds.some(h => h.type === 'START');
  const hasTop = holds.some(h => h.type === 'TOP');
  
  if (!hasStart) {
    return { valid: false, error: 'Route must have at least one START hold' };
  }
  
  if (!hasTop) {
    return { valid: false, error: 'Route must have at least one TOP hold' };
  }
  
  // Validate hold positions
  for (const hold of holds) {
    if (!validateHoldPosition(hold.x, hold.y, hold.r)) {
      return { valid: false, error: 'Invalid hold position detected' };
    }
  }
  
  return { valid: true };
};
