// src/hooks/useVisibleRoutes.ts
import { useEffect, useMemo, useRef, useState } from 'react';

interface BaseRoute {
  id: string;
  x: number;
  y: number;
  [key: string]: any;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const useVisibleRoutes = <T extends BaseRoute>(
  routes: T[],
  transform: { scale: number; tx: number; ty: number },
  dims: { viewW: number; viewH: number },
  imgDims: { imgW: number; imgH: number },
  throttleMs = 100
): T[] => {
  const [visible, setVisible] = useState<T[]>(routes);
  const lastTs = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rect: Rect = useMemo(() => {
    const { scale, tx, ty } = transform;
    const { viewW, viewH } = dims;

    // חישוב המלבן הנראה בקואורדינטות התמונה
    const left = Math.max(0, -tx / scale);
    const top = Math.max(0, -ty / scale);
    const right = Math.min(imgDims.imgW, left + viewW / scale);
    const bottom = Math.min(imgDims.imgH, top + viewH / scale);

    return { left, top, right, bottom };
  }, [transform.scale, transform.tx, transform.ty, dims.viewW, dims.viewH, imgDims.imgW, imgDims.imgH]);

  useEffect(() => {
    // ביטול timeout קודם
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - lastTs.current;

    const updateVisibleRoutes = () => {
      lastTs.current = Date.now();
      const visibleRoutes = routes.filter(route =>
        route.x >= rect.left &&
        route.x <= rect.right &&
        route.y >= rect.top &&
        route.y <= rect.bottom
      );
      setVisible(visibleRoutes);
    };

    if (timeSinceLastUpdate >= throttleMs) {
      // אם עבר מספיק זמן, עדכן מיד
      updateVisibleRoutes();
    } else {
      // אחרת, המתן עד שיעבור הזמן הנדרש
      timeoutRef.current = setTimeout(updateVisibleRoutes, throttleMs - timeSinceLastUpdate);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [rect, routes, throttleMs]);

  return visible;
};

// שמירה על תאימות לאחור
export default function useVisibleRoutesLegacy(
  routes,
  scale,
  translateX,
  translateY,
  mapWidth,
  mapHeight,
  circleRadius = 15,
) {
  return useMemo(() => {
    if (!routes || !Array.isArray(routes)) {
      return [];
    }

    // חישוב פשוט של viewport
    const viewW = mapWidth;
    const viewH = mapHeight;
    const left = -translateX / scale;
    const top = -translateY / scale;
    const right = left + viewW / scale;
    const bottom = top + viewH / scale;

    const visibleRoutes = routes.filter((route) => {
      if (!route) return false;
      return route.x >= left && route.x <= right && route.y >= top && route.y <= bottom;
    });

    return visibleRoutes;
  }, [
    routes,
    scale,
    translateX,
    translateY,
    mapWidth,
    mapHeight,
    circleRadius,
  ]);
}
