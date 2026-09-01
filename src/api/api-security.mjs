const DEFAULT_CLINICAL_ROLES = ["clinician", "medical", "doctor"];

export function parseAllowedOrigins(value, { nodeEnv = process.env.NODE_ENV } = {}) {
  const configured = String(value || "").split(",")
    .map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean);
  if (configured.length > 0) return new Set(configured);
  if (nodeEnv === "production") throw new Error("ALLOWED_ORIGINS must be configured in production");
  return new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
}

export function createCorsOptions(allowedOrigins) {
  return {
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    maxAge: 600,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin.replace(/\/$/, ""))) return callback(null, true);
      const error = new Error("Origin is not allowed");
      error.status = 403;
      return callback(error);
    },
  };
}

export function extractBearerToken(authorization) {
  const match = /^Bearer\s+(.+)$/i.exec(String(authorization || "").trim());
  return match?.[1]?.trim() || null;
}

export function createClinicalAuthMiddleware({ supabase, allowedRoles = DEFAULT_CLINICAL_ROLES }) {
  const roleSet = new Set(allowedRoles.map((role) => String(role).trim().toLowerCase()));
  return async function requireClinicalUser(req, res, next) {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) return res.status(401).json({ error: "缺少有效的登入憑證。" });
    if (!supabase) return res.status(503).json({ error: "身分驗證服務尚未設定。" });

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      const user = authData?.user;
      if (authError || !user?.id) return res.status(401).json({ error: "登入憑證無效或已過期。" });

      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profileError) throw profileError;
      const role = String(profile?.role || "").trim().toLowerCase();
      if (!roleSet.has(role)) return res.status(403).json({ error: "此帳號沒有使用臨床 AI 的權限。" });

      req.auth = { userId: user.id, role };
      return next();
    } catch (error) {
      console.error("Clinical API authentication failed:", error?.message || error);
      return res.status(503).json({ error: "暫時無法驗證使用者身分。" });
    }
  };
}

export function createRateLimiter({ windowMs = 60_000, max = 20, now = Date.now } = {}) {
  const clients = new Map();
  return function rateLimit(req, res, next) {
    const key = req.auth?.userId || req.ip || req.socket?.remoteAddress || "unknown";
    const currentTime = now();
    const existing = clients.get(key);
    const entry = !existing || currentTime >= existing.resetAt
      ? { count: 0, resetAt: currentTime + windowMs } : existing;
    entry.count += 1;
    clients.set(key, entry);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000))));
      return res.status(429).json({ error: "請求過於頻繁，請稍後再試。" });
    }
    if (clients.size > 10_000) {
      for (const [clientKey, value] of clients) if (currentTime >= value.resetAt) clients.delete(clientKey);
    }
    return next();
  };
}

export function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
