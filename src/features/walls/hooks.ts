import { useEffect, useState, useCallback } from "react";
import { Wall, listenToWalls, addWall as addWallService } from "@/features/walls/wallsService";

export function useWalls() {
  const [walls, setWalls] = useState<Wall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = listenToWalls((ws) => {
      setWalls(ws);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { walls, loading };
}

export function useAddWall() {
  const [loading, setLoading] = useState(false);
  const addWall = useCallback(async (payload: {
    name: string;
    width: number;
    height: number;
    isPublic: boolean;
    imageUri: string;
  }) => {
    setLoading(true);
    try {
      const id = await addWallService(payload);
      return id;
    } finally {
      setLoading(false);
    }
  }, []);

  return { addWall, loading };
}
