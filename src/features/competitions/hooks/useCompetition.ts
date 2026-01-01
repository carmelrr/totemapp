/**
 * @fileoverview Competition Hooks
 * @description React hooks for competition data and state management
 */

import { useState, useEffect, useCallback } from 'react';
import { CompetitionService } from '../services/CompetitionService';
import { ResultsService } from '../services/ResultsService';
import { ParticipantService } from '../services/ParticipantService';
import { JudgeService } from '../services/JudgeService';
import { CompetitionRoutesService } from '../services/CompetitionRoutesService';
import {
  Competition,
  CompetitionRoute,
  Participant,
  Judge,
  LeaderboardEntry,
  ParticipantResult,
} from '../types';

// =============== Competition Hooks ===============

/**
 * Hook to get a single competition with real-time updates
 */
export function useCompetition(competitionId: string | null) {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!competitionId) {
      setCompetition(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = CompetitionService.subscribeToCompetition(
      competitionId,
      (comp) => {
        setCompetition(comp);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [competitionId]);

  return { competition, loading, error };
}

/**
 * Hook to get active competitions
 */
export function useActiveCompetitions() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = CompetitionService.subscribeToActiveCompetitions(
      (comps) => {
        setCompetitions(comps);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { competitions, loading, error, hasActiveCompetition: competitions.length > 0 };
}

/**
 * Hook to get all competitions
 */
export function useAllCompetitions() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = CompetitionService.subscribeToAllCompetitions(
      (comps) => {
        setCompetitions(comps);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const comps = await CompetitionService.getAllCompetitions();
      setCompetitions(comps);
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  return { competitions, loading, error, refresh };
}

// =============== Leaderboard Hooks ===============

/**
 * Hook to get competition leaderboard with real-time updates
 */
export function useCompetitionLeaderboard(
  competitionId: string | null,
  category?: string
) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!competitionId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = ResultsService.subscribeToLeaderboard(
      competitionId,
      (leaderboard) => {
        setEntries(leaderboard);
        setLoading(false);
      },
      category
    );

    return () => unsubscribe();
  }, [competitionId, category]);

  return { entries, loading, error };
}

/**
 * Hook to get a participant's result
 */
export function useParticipantResult(
  competitionId: string | null,
  participantId: string | null
) {
  const [result, setResult] = useState<ParticipantResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!competitionId || !participantId) {
      setResult(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = ResultsService.subscribeToParticipantResult(
      competitionId,
      participantId,
      (res) => {
        setResult(res);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [competitionId, participantId]);

  return { result, loading, error };
}

// =============== Participant Hooks ===============

/**
 * Hook to get competition participants
 */
export function useParticipants(
  competitionId: string | null,
  category?: string
) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!competitionId) {
      setParticipants([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = ParticipantService.subscribeToParticipants(
      competitionId,
      (parts) => {
        setParticipants(parts);
        setLoading(false);
      },
      category
    );

    return () => unsubscribe();
  }, [competitionId, category]);

  const refresh = useCallback(async () => {
    if (!competitionId) return;
    try {
      const parts = await ParticipantService.getParticipants(competitionId, category);
      setParticipants(parts);
    } catch (err) {
      setError(err as Error);
    }
  }, [competitionId, category]);

  return { participants, loading, error, count: participants.length, refresh };
}

// =============== Judge Hooks ===============

/**
 * Hook to get competition judges
 */
export function useJudges(competitionId: string | null) {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!competitionId) {
      setJudges([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = JudgeService.subscribeToJudges(
      competitionId,
      (jdgs) => {
        setJudges(jdgs);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [competitionId]);

  const refresh = useCallback(async () => {
    if (!competitionId) return;
    try {
      const jdgs = await JudgeService.getJudges(competitionId);
      setJudges(jdgs);
    } catch (err) {
      setError(err as Error);
    }
  }, [competitionId]);

  return { judges, loading, error, refresh };
}

/**
 * Hook to check if current user is a judge
 */
export function useIsJudge(competitionId: string | null, userId: string | null) {
  const [isJudge, setIsJudge] = useState(false);
  const [isHeadJudge, setIsHeadJudge] = useState(false);
  const [permissions, setPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!competitionId || !userId) {
      setIsJudge(false);
      setIsHeadJudge(false);
      setPermissions(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    JudgeService.getJudge(competitionId, userId)
      .then((judge) => {
        setIsJudge(!!judge);
        setIsHeadJudge(judge?.role === 'head_judge');
        setPermissions(judge?.permissions || null);
      })
      .catch(() => {
        setIsJudge(false);
        setIsHeadJudge(false);
        setPermissions(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [competitionId, userId]);

  return { isJudge, isHeadJudge, permissions, loading };
}

// =============== Routes Hooks ===============

/**
 * Hook to get competition routes
 */
export function useCompetitionRoutes(competitionId: string | null) {
  const [routes, setRoutes] = useState<CompetitionRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!competitionId) {
      setRoutes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = CompetitionRoutesService.subscribeToRoutes(
      competitionId,
      (rts) => {
        setRoutes(rts);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [competitionId]);

  const refresh = useCallback(async () => {
    if (!competitionId) return;
    try {
      const rts = await CompetitionRoutesService.getRoutes(competitionId);
      setRoutes(rts);
    } catch (err) {
      setError(err as Error);
    }
  }, [competitionId]);

  return { routes, loading, error, count: routes.length, refresh };
}

// =============== Competition Timer Hook ===============

/**
 * Hook for competition countdown timer
 */
export function useCompetitionTimer(competition: Competition | null) {
  const [timeRemaining, setTimeRemaining] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: true,
  });

  useEffect(() => {
    if (!competition || competition.status !== 'active') {
      setTimeRemaining({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
      return;
    }

    const updateTime = () => {
      const remaining = CompetitionService.getRemainingTime(competition);
      setTimeRemaining(remaining);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [competition]);

  const formatted = `${String(timeRemaining.hours).padStart(2, '0')}:${String(
    timeRemaining.minutes
  ).padStart(2, '0')}:${String(timeRemaining.seconds).padStart(2, '0')}`;

  return {
    ...timeRemaining,
    formatted,
  };
}

// =============== Combined Competition Data Hook ===============

/**
 * Hook to get all competition data in one call
 */
export function useCompetitionData(competitionId: string | null) {
  const { competition, loading: competitionLoading } = useCompetition(competitionId);
  const { routes, loading: routesLoading, count: routeCount } = useCompetitionRoutes(competitionId);
  const { participants, loading: participantsLoading, count: participantCount } = useParticipants(competitionId);
  const { entries: leaderboard, loading: leaderboardLoading } = useCompetitionLeaderboard(competitionId);
  const timer = useCompetitionTimer(competition);

  const loading = competitionLoading || routesLoading || participantsLoading || leaderboardLoading;

  return {
    competition,
    routes,
    routeCount,
    participants,
    participantCount,
    leaderboard,
    timer,
    loading,
    isActive: competition?.status === 'active',
  };
}
