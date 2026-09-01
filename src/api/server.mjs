// src/api/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  createClinicalAuthMiddleware,
  createCorsOptions,
  createRateLimiter,
  parseAllowedOrigins,
  readPositiveInteger,
} from "./api-security.mjs";

dotenv.config();
dotenv.config({ path: ".env.rag" });

const { default: clinicalAssistantHandler } = await import("./clinical-assistant.mjs");

const app = express();
const PORT = process.env.PORT || 3001;
const REQUEST_LIMIT = process.env.CLINICAL_API_REQUEST_LIMIT || "256kb";
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
const authClient = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
const requireClinicalUser = createClinicalAuthMiddleware({ supabase: authClient });
const rateLimit = createRateLimiter({
  windowMs: readPositiveInteger(process.env.CLINICAL_API_RATE_WINDOW_MS, 60_000),
  max: readPositiveInteger(process.env.CLINICAL_API_RATE_MAX, 20),
});
const clinicalCors = cors(createCorsOptions(allowedOrigins));

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: REQUEST_LIMIT }));

app.get("/", (req, res) => {
  res.send("Clinical Assistant API is running.");
});

const handleClinicalAssistant = async (req, res) => {
  try {
    await clinicalAssistantHandler(req, res);
  } catch (error) {
    console.error("clinical-assistant API error:", error);

    res.status(500).json({
      answer: "AI 臨床助手後端發生錯誤，請稍後再試。",
      sources: [],
      ragUsed: false,
      fallback: true,
      error: error.message,
    });
  }
};

const secureClinicalRoute = [clinicalCors, requireClinicalUser, rateLimit, handleClinicalAssistant];
app.options("/api/clinical-assistant", clinicalCors);
app.options("/clinical-assistant", clinicalCors);
app.post("/api/clinical-assistant", ...secureClinicalRoute);
app.post("/clinical-assistant", ...secureClinicalRoute);

app.use((error, req, res, next) => {
  if (error?.type === "entity.too.large") return res.status(413).json({ error: "請求資料過大。" });
  if (error?.message === "Origin is not allowed") {
    return res.status(403).json({ error: "此來源不允許存取臨床 API。" });
  }
  return next(error);
});

app.listen(PORT, () => {
  console.log(`Clinical assistant server running on http://localhost:${PORT}`);
});
