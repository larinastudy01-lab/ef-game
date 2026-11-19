import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { isSessionExpiredError } from "../lib/authErrors";

const ACCESS_STATE = {
  checking: "checking",
  allowed: "allowed",
  denied: "denied",
};
const NO_ROLE_RESTRICTIONS = [];

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

export function isAllowedRole(role, allowedRoles) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true;
  const normalizedRole = normalizeRole(role);
  return allowedRoles.some((allowedRole) => normalizeRole(allowedRole) === normalizedRole);
}

function ProtectedRoute({ children, allowedRoles = NO_ROLE_RESTRICTIONS, redirectTo = "/login" }) {
  const location = useLocation();
  const [accessState, setAccessState] = useState(ACCESS_STATE.checking);
  const [authExpired, setAuthExpired] = useState(false);

  useEffect(() => {
    let active = true;
    let revision = 0;
    let authTimer;

    const validateUser = async (knownUser) => {
      const request = ++revision;
      const current = () => active && request === revision;
      try {
        let user = knownUser;
        if (!user) {
          const { data, error } = await supabase.auth.getUser();
          if (error) throw error;
          user = data.user;
        }

        if (!user) {
          if (current()) { setAuthExpired(true); setAccessState(ACCESS_STATE.denied); }
          return;
        }

        if (allowedRoles.length === 0) {
          if (current()) { setAuthExpired(false); setAccessState(ACCESS_STATE.allowed); }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (current()) {
          setAuthExpired(false);
          setAccessState(
            isAllowedRole(profile?.role, allowedRoles)
              ? ACCESS_STATE.allowed
              : ACCESS_STATE.denied
          );
        }
      } catch (error) {
        // Fail closed: a profile/network error must never reveal a protected page.
        console.warn("Protected route validation failed:", error);
        if (current()) { setAuthExpired(isSessionExpiredError(error)); setAccessState(ACCESS_STATE.denied); }
      }
    };

    validateUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        ++revision;
        window.clearTimeout(authTimer);
        setAuthExpired(true);
        setAccessState(ACCESS_STATE.denied);
        return;
      }

      // INITIAL_SESSION can arrive before getUser() finishes. Ignore an empty
      // initial event so it cannot race the authoritative validation above.
      if (!session?.user) return;

      setAccessState(ACCESS_STATE.checking);
      const scheduled = ++revision;
      window.clearTimeout(authTimer);
      // Return from the auth callback before requesting authenticated data.
      authTimer = window.setTimeout(() => {
        if (active && scheduled === revision) void validateUser(session.user);
      }, 0);
    });

    return () => {
      active = false;
      ++revision;
      window.clearTimeout(authTimer);
      authListener.subscription.unsubscribe();
    };
  }, [allowedRoles]);

  if (accessState === ACCESS_STATE.checking) {
    return <div className="route-loading">載入中...</div>;
  }

  if (accessState === ACCESS_STATE.denied) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname + location.search, authExpired }} />;
  }

  // This guard improves navigation UX only. Supabase RLS remains the authority
  // that must enforce access to every patient and clinical record.
  return children;
}

export default ProtectedRoute;
