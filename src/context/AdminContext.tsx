import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/features/data/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface AdminContextType {
  isAdmin: boolean;
  adminModeEnabled: boolean;
  setAdminModeEnabled: (enabled: boolean) => void;
  toggleAdminMode: () => void;
  loading: boolean;
}

const AdminContext = createContext<AdminContextType>({
  isAdmin: false,
  adminModeEnabled: false,
  setAdminModeEnabled: () => {},
  toggleAdminMode: () => {},
  loading: true,
});

export const useAdmin = () => useContext(AdminContext);

interface AdminProviderProps {
  children: ReactNode;
}

export function AdminProvider({ children }: AdminProviderProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Check Firebase custom claims first
          const tokenResult = await user.getIdTokenResult();
          if (tokenResult.claims.admin === true) {
            setIsAdmin(true);
            setLoading(false);
            return;
          }

          // Fallback: Check Firestore users collection for admin field
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setIsAdmin(userData?.isAdmin === true || userData?.role === 'admin');
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
        setAdminModeEnabled(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleAdminMode = useCallback(() => {
    if (isAdmin) {
      setAdminModeEnabled((prev) => !prev);
    }
  }, [isAdmin]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo(() => ({
    isAdmin,
    adminModeEnabled,
    setAdminModeEnabled,
    toggleAdminMode,
    loading,
  }), [isAdmin, adminModeEnabled, toggleAdminMode, loading]);

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export default AdminContext;
