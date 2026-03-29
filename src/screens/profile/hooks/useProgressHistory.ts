import { useState, useEffect } from "react";
import { fetchProgressHistory } from "../services/statsService";
import type { ProgressHistory } from "../types";

export function useProgressHistory(userId: string | null) {
  const [progressData, setProgressData] = useState<ProgressHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchProgressHistory(userId)
      .then((data) => {
        if (!cancelled) setProgressData(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load progress");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId]);

  return { progressData, loading, error };
}
