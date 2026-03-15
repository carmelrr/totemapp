import { useState, useEffect } from "react";
import { BlockService } from "./BlockService";
import { useAuth } from "@/context/AuthContext";

export function useBlockedUsers() {
  const { user } = useAuth();
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) {
      setBlockedIds([]);
      setLoading(false);
      return;
    }
    try {
      const ids = await BlockService.getBlockedUserIds();
      setBlockedIds(ids);
    } catch (error) {
      console.error("Error loading blocked users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [user?.uid]);

  const isBlocked = (userId: string) => blockedIds.includes(userId);

  return { blockedIds, isBlocked, loading, refresh };
}
