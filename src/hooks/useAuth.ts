import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { authService } from "@/services/auth.service";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener first
    const { data: { subscription } } = authService.onAuthStateChange((session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    // Then check for existing session
    authService.getSession().then((session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const data = await authService.signIn(email, password);
    return data;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const data = await authService.signUp(email, password, fullName);
    return data;
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
    setSession(null);
  };

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
  };
}
