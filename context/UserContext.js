import React, { createContext, useContext } from 'react';

const UserContext = createContext({ isAdmin: false });

export function UserProvider({ children, isAdmin }) {
  return <UserContext.Provider value={{ isAdmin }}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
