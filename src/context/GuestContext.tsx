import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';

interface GuestContextType {
  isGuest: boolean;
  setIsGuest: (value: boolean) => void;
  requireAuth: (t: any) => boolean;
}

const GuestContext = createContext<GuestContextType>({
  isGuest: false,
  setIsGuest: () => {},
  requireAuth: () => true,
});

export const useGuest = () => useContext(GuestContext);

export const GuestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isGuest, setIsGuest] = useState(false);

  const requireAuth = useCallback((t: any) => {
    if (isGuest) {
      Alert.alert(
        t.auth.loginRequired,
        t.auth.loginRequiredMessage,
        [
          { text: t.common.cancel, style: 'cancel' },
          { 
            text: t.auth.login, 
            onPress: () => setIsGuest(false),
          },
        ]
      );
      return false;
    }
    return true;
  }, [isGuest]);

  const value = useMemo(() => ({
    isGuest,
    setIsGuest,
    requireAuth,
  }), [isGuest, requireAuth]);

  return <GuestContext.Provider value={value}>{children}</GuestContext.Provider>;
};
