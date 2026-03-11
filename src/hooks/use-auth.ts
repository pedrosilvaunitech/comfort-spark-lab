import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { diagnoseAuthError, clearSupabaseAuthStorage } from "@/lib/auth-recovery";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchRoles = useCallback(async (userId: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) {
        console.error("[Auth] fetchRoles error:", error);
        return [];
      }
      return data?.map((r) => r.role) || [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const initialize = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mountedRef.current) return;
        
        if (error) {
          const errorType = diagnoseAuthError(error, "getSession");
          if (errorType === "auth") {
            // Tokens were cleared, start fresh
            setUser(null);
            setRoles([]);
            return;
          }
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const userRoles = await fetchRoles(currentUser.id);
          if (mountedRef.current) setRoles(userRoles);
        } else {
          setRoles([]);
        }
      } catch (err: any) {
        const errorType = diagnoseAuthError(err, "initialize");
        if (errorType === "auth") {
          setUser(null);
          setRoles([]);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          initializedRef.current = true;
        }
      }
    };

    initialize();

    // Safety timeout: force loading=false after 5s
    const timeout = setTimeout(() => {
      if (mountedRef.current && loading) {
        console.warn("[Auth] Timeout - forcing loading=false");
        setLoading(false);
        initializedRef.current = true;
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!initializedRef.current || !mountedRef.current) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const userRoles = await fetchRoles(currentUser.id);
        if (mountedRef.current) setRoles(userRoles);
      } else {
        if (mountedRef.current) setRoles([]);
      }
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = roles.includes("admin");
  const isGestor = roles.includes("gestor") || isAdmin;
  const isOperator = roles.includes("operator") || isAdmin;

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, loading, roles, isAdmin, isGestor, isOperator, signOut };
}
