/**
 * @fileoverview Q&A Hooks
 */

import { useState, useEffect } from 'react';
import { auth } from '@/features/data/firebase';
import type { Question } from './types';
import {
  subscribeToKnowledgeBase,
  subscribeToMyQuestions,
  subscribeToPendingQuestions,
  subscribeToAllAnswered,
} from './qaService';

export function useKnowledgeBase() {
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = subscribeToKnowledgeBase((data) => {
      setItems(data);
      setLoading(false);
    });
    return unsub;
  }, []);
  return { items, loading };
}

export function useMyQuestions() {
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const uid = auth.currentUser?.uid;
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    const unsub = subscribeToMyQuestions(uid, (data) => {
      setItems(data);
      setLoading(false);
    });
    return unsub;
  }, [uid]);
  return { items, loading };
}

export function usePendingQuestions() {
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = subscribeToPendingQuestions((data) => {
      setItems(data);
      setLoading(false);
    });
    return unsub;
  }, []);
  return { items, loading };
}

export function useAllAnswered() {
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = subscribeToAllAnswered((data) => {
      setItems(data);
      setLoading(false);
    });
    return unsub;
  }, []);
  return { items, loading };
}
