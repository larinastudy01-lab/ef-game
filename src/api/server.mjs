// src/api/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const { default: clinicalAssistantHandler } = await import("./clinical-assistant.mjs");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

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

app.post("/api/clinical-assistant", handleClinicalAssistant);
app.post("/clinical-assistant", handleClinicalAssistant);

app.listen(PORT, () => {
  console.log(`Clinical assistant server running on http://localhost:${PORT}`);
});