import { useMemo } from 'react';

export default function useVisibleRoutes(routes, scale, translateX, translateY, containerWidth, containerHeight) {
  return useMemo(() => {
    const visible = routes.filter((r) => {
      const x = (r.x / 2560) * containerWidth * scale + translateX;
      const y = (r.y / 1600) * containerHeight * scale + translateY;
      return x >= 0 && x <= containerWidth && y >= 0 && y <= containerHeight;
    });
    return visible;
  }, [routes, scale, translateX, translateY]);
}

