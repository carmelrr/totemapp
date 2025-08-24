import { useState, useEffect, useCallback } from 'react';
import { collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/features/data/firebase';

export type RouteStatus = 'unsent' | 'project' | 'sent' | 'flashed';

interface UserRouteData {
  status: RouteStatus;
  attempts: number;
  lastAttempt?: Date;
  notes?: string;
  rating?: number; // 1-5 כוכבים
}

/**
 * Hook לניהול סטטוס אישי של משתמש עבור מסלולים
 * שומר בFirestore עבור כל משתמש רשומה נפרדת של סטטוס מסלולים
 */
export function useUserRouteStatus() {
  const [userRouteData, setUserRouteData] = useState<Record<string, UserRouteData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = auth.currentUser?.uid;

  // טעינת נתוני משתמש מFirestore
  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const userRoutesRef = doc(db, 'userRoutes', userId);
    
    const unsubscribe = onSnapshot(
      userRoutesRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserRouteData(data.routes || {});
        } else {
          setUserRouteData({});
        }
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching user route data:', err);
        setError(err.message);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [userId]);

  // עדכון סטטוס מסלול
  const updateRouteStatus = useCallback(async (
    routeId: string, 
    status: RouteStatus,
    additionalData?: Partial<Omit<UserRouteData, 'status'>>
  ) => {
    if (!userId) {
      throw new Error('משתמש לא מחובר');
    }

    try {
      const userRoutesRef = doc(db, 'userRoutes', userId);
      
      const currentData = userRouteData[routeId] || { 
        status: 'unsent', 
        attempts: 0 
      };

      const updatedRouteData: UserRouteData = {
        ...currentData,
        ...additionalData,
        status,
        attempts: status === 'sent' || status === 'flashed' 
          ? currentData.attempts + 1 
          : currentData.attempts,
        lastAttempt: new Date(),
      };

      const newUserData = {
        ...userRouteData,
        [routeId]: updatedRouteData,
      };

      await setDoc(userRoutesRef, { routes: newUserData }, { merge: true });
      
      // עדכון מקומי מיידי
      setUserRouteData(newUserData);
      
    } catch (err) {
      console.error('Error updating route status:', err);
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון סטטוס');
      throw err;
    }
  }, [userId, userRouteData]);

  // קבלת סטטוס של מסלול ספציפי
  const getRouteStatus = useCallback((routeId: string): RouteStatus => {
    return userRouteData[routeId]?.status || 'unsent';
  }, [userRouteData]);

  // קבלת נתונים מלאים של מסלול
  const getRouteData = useCallback((routeId: string): UserRouteData | null => {
    return userRouteData[routeId] || null;
  }, [userRouteData]);

  // סטטיסטיקות כלליות
  const getStatistics = useCallback(() => {
    const routes = Object.values(userRouteData);
    const totalRoutes = routes.length;
    const sentRoutes = routes.filter(r => r.status === 'sent' || r.status === 'flashed').length;
    const projectRoutes = routes.filter(r => r.status === 'project').length;
    const flashedRoutes = routes.filter(r => r.status === 'flashed').length;
    const totalAttempts = routes.reduce((sum, route) => sum + route.attempts, 0);

    return {
      totalRoutes,
      sentRoutes,
      projectRoutes,
      flashedRoutes,
      totalAttempts,
      successRate: totalRoutes > 0 ? (sentRoutes / totalRoutes) * 100 : 0,
    };
  }, [userRouteData]);

  // דירוג מסלול (1-5 כוכבים)
  const rateRoute = useCallback(async (routeId: string, rating: number) => {
    if (rating < 1 || rating > 5) {
      throw new Error('דירוג חייב להיות בין 1 ל-5');
    }

    const currentData = userRouteData[routeId] || { 
      status: 'unsent', 
      attempts: 0 
    };

    await updateRouteStatus(routeId, currentData.status, { rating });
  }, [updateRouteStatus, userRouteData]);

  // הוספת הערה למסלול
  const addRouteNote = useCallback(async (routeId: string, notes: string) => {
    const currentData = userRouteData[routeId] || { 
      status: 'unsent', 
      attempts: 0 
    };

    await updateRouteStatus(routeId, currentData.status, { notes });
  }, [updateRouteStatus, userRouteData]);

  return {
    userRouteData,
    isLoading,
    error,
    updateRouteStatus,
    getRouteStatus,
    getRouteData,
    getStatistics,
    rateRoute,
    addRouteNote,
  };
}
