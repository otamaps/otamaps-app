// app/context/AuthContext.tsx
import { supabase } from "@/lib/supabase"; // your supabase client
import { reportHandledError, setSentryUser } from "@/lib/sentry";
import { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          reportHandledError(error, {
            area: "auth",
            operation: "get_session",
          });
        }
        setSession(session);
        setSentryUser(
          session?.user
            ? { id: session.user.id, email: session.user.email }
            : null
        );
      })
      .catch((error) => {
        reportHandledError(error, {
          area: "auth",
          operation: "get_session",
        });
      })
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setSentryUser(
        session?.user
          ? { id: session.user.id, email: session.user.email }
          : null
      );
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
