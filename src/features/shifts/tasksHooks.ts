/**
 * @fileoverview Shift Tasks Hooks
 * @description React hooks for staff task checklists.
 */

import { useState, useEffect } from 'react';
import { auth } from '@/features/data/firebase';
import type { TaskList, ShiftTask } from './types';
import {
  subscribeToTaskLists,
  subscribeToMyShiftTasks,
  subscribeToShiftTasks,
} from './tasksService';

/** All task lists (live). */
export function useTaskLists() {
  const [lists, setLists] = useState<TaskList[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToTaskLists((data) => {
      setLists(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { lists, loading };
}

/** Current user's tasks on a specific shift (live). */
export function useMyShiftTasks(shiftId: string | null) {
  const [tasks, setTasks] = useState<ShiftTask[]>([]);
  const [loading, setLoading] = useState(true);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!shiftId || !uid) {
      setTasks([]);
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeToMyShiftTasks(shiftId, uid, (data) => {
      setTasks(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [shiftId, uid]);

  return { tasks, loading };
}

/** All tasks on a shift — manager monitoring (live). */
export function useShiftTasks(shiftId: string | null) {
  const [tasks, setTasks] = useState<ShiftTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shiftId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeToShiftTasks(shiftId, (data) => {
      setTasks(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [shiftId]);

  return { tasks, loading };
}
