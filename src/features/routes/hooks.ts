import { useState, useCallback } from "react";
import { generateRouteId, saveRoute } from "@/features/data/firebase";

export interface RouteCreatePayload {
  wallId: string;
  name: string;
  color: string;
  grade: string;
  holds: { x: number; y: number }[]; // normalized
}

export function useAddRoute() {
  const [loading, setLoading] = useState(false);

  const addRoute = useCallback(async (payload: RouteCreatePayload) => {
    setLoading(true);
    try {
      const id = generateRouteId();
      const route = {
        id,
        ...payload,
        createdAt: Date.now(),
      } as any;

      await saveRoute(route);
      return id;
    } finally {
      setLoading(false);
    }
  }, []);

  return { addRoute, loading };
}
