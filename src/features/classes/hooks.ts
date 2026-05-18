/**
 * @fileoverview React hooks for the Class Planning module. Each hook
 * subscribes to its Firestore collection and exposes loading state.
 */

import { useEffect, useState } from "react";
import {
  DEFAULT_CLASS_SETTINGS,
  type ClassGroup,
  type ClassLocation,
  type ClassProgram,
  type ClassSession,
  type ClassSettings,
} from "./types";
import { listenToClassSettings } from "./services/classSettingsService";
import { listenToClassLocations } from "./services/classLocationsService";
import { listenToClassPrograms } from "./services/classProgramsService";
import { listenToClassGroups } from "./services/classGroupsService";
import { listenToClassSessions } from "./services/classSessionsService";

export function useClassSettings() {
  const [settings, setSettings] = useState<ClassSettings>(DEFAULT_CLASS_SETTINGS);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = listenToClassSettings(
      (s) => {
        setSettings(s);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);
  return { settings, loading };
}

export function useClassLocations() {
  const [locations, setLocations] = useState<ClassLocation[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = listenToClassLocations(
      (l) => {
        setLocations(l);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);
  return { locations, loading };
}

export function useClassPrograms() {
  const [programs, setPrograms] = useState<ClassProgram[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = listenToClassPrograms(
      (p) => {
        setPrograms(p);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);
  return { programs, loading };
}

export function useClassGroups() {
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = listenToClassGroups(
      (g) => {
        setGroups(g);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);
  return { groups, loading };
}

export function useClassSessions() {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = listenToClassSessions(
      (s) => {
        setSessions(s);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);
  return { sessions, loading };
}
