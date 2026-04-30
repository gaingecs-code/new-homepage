import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isLocalMode, supabase, supabaseEnabled } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      if (!supabaseEnabled) {
        const local = localStorage.getItem("admin_demo_login") === "true";
        if (!ignore) {
          setSession(local ? { user: { email: "demo@local" } } : null);
          setLoading(false);
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!ignore) {
        setSession(data.session ?? null);
        setLoading(false);
      }
    }

    bootstrap();

    if (!supabaseEnabled) {
      return () => {
        ignore = true;
      };
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      ignore = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function signInWithPassword(email, password) {
    if (!supabaseEnabled) {
      if (email.trim() && password.trim()) {
        localStorage.setItem("admin_demo_login", "true");
        setSession({ user: { email: email.trim() } });
        return { error: null };
      }
      return { error: { message: "이메일과 비밀번호를 입력해 주세요." } };
    }
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    if (!supabaseEnabled) {
      localStorage.removeItem("admin_demo_login");
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
  }

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signInWithPassword,
      signOut,
      supabaseEnabled,
      isLocalMode,
    }),
    [loading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth는 AuthProvider 내부에서 사용해야 합니다.");
  }
  return ctx;
}
