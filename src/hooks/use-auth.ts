import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);
  const initializedRef = useRef(false);

  const fetchRoles = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      return data?.map((r) => r.role) || [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          const userRoles = await fetchRoles(currentUser.id);
          if (!cancelled) setRoles(userRoles);
        } else {
          setRoles([]);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          setLoading(false);
          initializedRef.current = true;
        }
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!initializedRef.current) return; // Skip until initial load done
      
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        const userRoles = await fetchRoles(currentUser.id);
        if (!cancelled) setRoles(userRoles);
      } else {
        setRoles([]);
      }
    });

    return () => {
      cancelled = true;
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
