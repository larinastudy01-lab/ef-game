import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    };

    checkSession();
  }, []);

  if (loading) {
    return <div style={{ padding: "40px" }}>載入中...</div>;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;