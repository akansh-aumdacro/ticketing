import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "super_admin" | "admin" | "hod" | "user" | "assigned_person";

export interface Permissions {
  tickets: {
    create: boolean;
    viewAll: boolean;
    viewOwn: boolean;
    assign: boolean;
    updateStatus: boolean;
    close: boolean;
    delete: boolean;
  };
  dashboard: { view: boolean; scope: "all" | "department" | "own" };
  sidebar: {
    overview: boolean;
    analytics: boolean;
    summary: boolean;
    createTicket: boolean;
    myTickets: boolean;
    pendingTickets: boolean;
    assignedTickets: boolean;
    departmentTickets: boolean;
    pcReview: boolean;
    manageUsers: boolean;
    settings: boolean;
  };
  department: "all" | "own";
}

export const FULL_PERMISSIONS: Permissions = {
  tickets: { create: true, viewAll: true, viewOwn: true, assign: true, updateStatus: true, close: true, delete: true },
  dashboard: { view: true, scope: "all" },
  sidebar: {
    overview: true, analytics: true, summary: true, createTicket: true, myTickets: true,
    pendingTickets: true, assignedTickets: true, departmentTickets: true, pcReview: true, manageUsers: true, settings: true,
  },
  department: "all",
};

const EMPTY_PERMISSIONS: Permissions = {
  tickets: { create: false, viewAll: false, viewOwn: false, assign: false, updateStatus: false, close: false, delete: false },
  dashboard: { view: false, scope: "own" },
  sidebar: {
    overview: false, analytics: false, summary: false, createTicket: false, myTickets: false,
    pendingTickets: false, assignedTickets: false, departmentTickets: false, pcReview: false, manageUsers: false, settings: false,
  },
  department: "own",
};

interface PermissionsContextType {
  permissions: Permissions;
  isSuperAdmin: boolean;
  loading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { role, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<Permissions>(EMPTY_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = role === "super_admin";

  useEffect(() => {
    if (authLoading) return;
    if (!role) {
      setPermissions(EMPTY_PERMISSIONS);
      setLoading(false);
      return;
    }
    if (isSuperAdmin) {
      setPermissions(FULL_PERMISSIONS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("roles" as any)
        .select("permissions")
        .eq("name", role)
        .maybeSingle();
      if (cancelled) return;
      const perms = (data as any)?.permissions as Permissions | undefined;
      setPermissions(perms ?? EMPTY_PERMISSIONS);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [role, authLoading, isSuperAdmin]);

  return (
    <PermissionsContext.Provider value={{ permissions, isSuperAdmin, loading }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    // Fail-safe: return empty permissions instead of throwing to avoid blank screens
    return { permissions: EMPTY_PERMISSIONS, isSuperAdmin: false, loading: true };
  }
  return ctx;
}
