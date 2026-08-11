import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const ACCESS_STATE = {
  checking: "checking",
  allowed: "allowed",
  denied: "denied",
};

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

export function isAllowedRole(role, allowedRoles) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true;
  const normalizedRole = normalizeRole(role);
  return allowedRoles.some((allowedRole) => normalizeRole(allowedRole) === normalizedRole);
}

function ProtectedRoute({ children, allowedRoles = [], redirectTo = "/login" }) {
  const location = useLocation();
  const [accessState, setAccessState] = useState(ACCESS_STATE.checking);

  useEffect(() => {
    let active = true;

    const validateUser = async (knownUser) => {
      try {
        let user = knownUser;
        if (!user) {
          const { data, error } = await supabase.auth.getUser();
          if (error) throw error;
          user = data.user;
        }

        if (!user) {
          if (active) setAccessState(ACCESS_STATE.denied);
          return;
        }

        if (allowedRoles.length === 0) {
          if (active) setAccessState(ACCESS_STATE.allowed);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (active) {
          setAccessState(
            isAllowedRole(profile?.role, allowedRoles)
              ? ACCESS_STATE.allowed
              : ACCESS_STATE.denied
          );
        }
      } catch (error) {
        // Fail closed: a profile/network error must never reveal a protected page.
        console.warn("Protected route validation failed:", error);
        if (active) setAccessState(ACCESS_STATE.denied);
      }
    };

    validateUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        setAccessState(ACCESS_STATE.denied);
        return;
      }

      // INITIAL_SESSION can arrive before getUser() finishes. Ignore an empty
      // initial event so it cannot race the authoritative validation above.
      if (!session?.user) return;

      setAccessState(ACCESS_STATE.checking);
      validateUser(session.user);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [allowedRoles]);

  if (accessState === ACCESS_STATE.checking) {
    return <div className="route-loading">載入中...</div>;
  }

  if (accessState === ACCESS_STATE.denied) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }

  // This guard improves navigation UX only. Supabase RLS remains the authority
  // that must enforce access to every patient and clinical record.
  return children;
}

export default ProtectedRoute;
