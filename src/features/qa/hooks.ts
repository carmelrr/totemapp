/**
 * @fileoverview Q&A Hooks
 */

import { useState, useEffect } from 'react';
import { auth } from '@/features/data/firebase';
import type { Question, QAFolder } from './types';
import {
  subscribeToKnowledgeBase,
  subscribeToMyQuestions,
  subscribeToPendingQuestions,
  subscribeToAllAnswered,
  subscribeToFolders,
  getQuestion,
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

export function useFolders() {
  const [items, setItems] = useState<QAFolder[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = subscribeToFolders((data) => {
      setItems(data);
      setLoading(false);
    });
    return unsub;
  }, []);
  return { items, loading };
}

/** One-shot fetch of a single question (used by the detail screen / cross-link targets). */
export function useQuestion(id?: string | null) {
  const [item, setItem] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (!id) {
      setItem(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getQuestion(id)
      .then((q) => {
        if (active) {
          setItem(q);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return { item, loading };
}
