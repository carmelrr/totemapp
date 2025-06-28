export function toRelativeCoords(x, y, imageWidth, imageHeight) {
  return {
    x: x / imageWidth,
    y: y / imageHeight,
  };
}

export function toAbsoluteCoords(relX, relY, imageWidth, imageHeight) {
  return {
    x: relX * imageWidth,
    y: relY * imageHeight,
  };
}

