import React, { createContext, useContext } from 'react';

// Password protection has been removed per user request.
// This module is kept as a no-op passthrough so existing imports continue to work.

const AuthContext = createContext({
  passwordSet: false,
  unlocked: true,
  requireUnlock: () => Promise.resolve(true),
  forceVerify: () => Promise.resolve(true),
  lock: () => {},
  markUnlocked: () => {},
  refreshStatus: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => <>{children}</>;
