import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setToken, getToken } from "@/lib/api";

type AppRole = "super_admin" | "admin" | "hod" | "user" | "assigned_person";

interface Profile {
  id: string;
  user_id: string;
  name: string;
  username: string | null;
  employee_id: string | null;
  department_id: string | null;
  contact: string | null;
  avatar_url: string | null;
  profile_picture?: string | null;
  unit_id?: string | null;
}

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextType {
  session: { user: AuthUser } | null;
  user: AuthUser | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string, employeeId?: string, contact?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = (data: { user: AuthUser; profile: Profile | null; role: AppRole | null }) => {
    setUser(data.user);
    setProfile(data.profile);
    setRole(data.role);
  };

  const clear = () => {
    setUser(null);
    setProfile(null);
    setRole(null);
  };

  // Bootstrap from a stored token on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const data = await api.auth.session();
        if (!cancelled) applySession(data);
      } catch {
        setToken(null);
        if (!cancelled) clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await api.auth.login(email, password);
      setToken(data.token);
      applySession(data);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, name: string, employeeId?: string, contact?: string) => {
    try {
      await api.auth.signup({ email, password, name, employee_id: employeeId, contact });
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    setToken(null);
    clear();
  };

  const refreshProfile = async () => {
    if (!getToken()) return;
    try {
      const data = await api.auth.session();
      applySession(data);
    } catch {
      /* ignore */
    }
  };

  return (
    <AuthContext.Provider
      value={{ session: user ? { user } : null, user, profile, role, loading, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
