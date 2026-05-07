import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../utils/auth';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

import { getCurrentUser } from '../utils/auth';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Race against a timeout so the page never hangs
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
        const supaUser = await Promise.race([getCurrentUser(), timeout]);
        if (supaUser) {
          setUserState(supaUser);
          localStorage.setItem('qstv_current_user', JSON.stringify(supaUser));
        } else {
          localStorage.removeItem('qstv_current_user');
        }
      } catch (e) {
        console.error('Failed to restore user session', e);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem('qstv_current_user', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('qstv_current_user');
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
