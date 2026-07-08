import path from "node:path";
import process from "node:process";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { pipeline, env } from "@huggingface/transformers";

/* =========================================================
 * 1. 載入環境變數
 * ======================================================= */

dotenv.config({
  path: path.resolve(process.cwd(), ".env.rag"),
});

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  HUGGINGFACE_EMBEDDING_MODEL = "Xenova/multilingual-e5-small",
  HUGGINGFACE_CACHE_PATH = "./.cache/huggingface",
  RAG_MATCH_THRESHOLD = "0.5",
  RAG_MATCH_COUNT = "8",
} = process.env;

/* =========================================================
 * 2. 驗證環境變數
 * ======================================================= */

function validateEnvironmentVariables() {
  const requiredVariables = {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  };

  const missingVariables = Object.entries(requiredVariables)
    .filter(([, value]) => !String(value || "").trim())
    .map(([key]) => key);

  if (missingVariables.length > 0) {
    throw new Error(
      [
        `缺少環境變數：${missingVariables.join(", ")}`,
        "請確認專案根目錄中的 .env.rag。",
      ].join("\n")
    );
  }
}

validateEnvironmentVariables();

/* =========================================================
 * 3. 建立 Supabase Client
 * ======================================================= */

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

/* =========================================================
 * 4. Hugging Face Embedding 設定
 * ======================================================= */

env.cacheDir = path.resolve(
  process.cwd(),
  HUGGINGFACE_CACHE_PATH
);

env.allowRemoteModels = true;

const EXPECTED_EMBEDDING_DIMENSION = 384;

let embeddingPipeline = null;

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log(
      `載入 Hugging Face 模型：${HUGGINGFACE_EMBEDDING_MODEL}`
    );

    embeddingPipeline = await pipeline(
      "feature-extraction",
      HUGGINGFACE_EMBEDDING_MODEL
    );

    console.log("Hugging Face 模型載入完成。");
  }

  return embeddingPipeline;
}

/* =========================================================
 * 5. 建立查詢向量
 * ======================================================= */

async function createQueryEmbedding(question) {
  const normalizedQuestion = String(question || "").trim();

  if (!normalizedQuestion) {
    throw new Error("查詢問題不能是空白。");
  }

  const extractor = await getEmbeddingPipeline();

  const output = await extractor(
    `query: ${normalizedQuestion}`,
    {
      pooling: "mean",
      normalize: true,
    }
  );

  const embedding = Array.from(output.data);

  if (
    !Array.isArray(embedding) ||
    embedding.length === 0
  ) {
    throw new Error(
      "Hugging Face 沒有產生有效的查詢向量。"
    );
  }

  if (
    embedding.length !==
    EXPECTED_EMBEDDING_DIMENSION
  ) {
    throw new Error(
      [
        "Embedding 維度不一致。",
        `預期：${EXPECTED_EMBEDDING_DIMENSION}`,
        `實際：${embedding.length}`,
      ].join(" ")
    );
  }

  return embedding;
}

/* =========================================================
 * 6. 參數工具
 * ======================================================= */

function parseNumber(value, fallbackValue) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : fallbackValue;
}

function normalizeFilter(value) {
  const normalizedValue = String(value || "").trim();

  if (
    !normalizedValue ||
    normalizedValue.toLowerCase() === "all" ||
    normalizedValue.toLowerCase() === "null" ||
    normalizedValue.toLowerCase() === "none"
  ) {
    return null;
  }

  return normalizedValue;
}

function clamp(value, minimum, maximum) {
  return Math.min(
    maximum,
    Math.max(minimum, value)
  );
}

/*
 * 使用方式：
 *
 * 預設測試：
 * node .\scripts\test-rag-search.mjs
 *
 * 自訂測試：
 * node .\scripts\test-rag-search.mjs "問題" DCCS all 0.5 8
 *
 * 參數順序：
 * 1. 問題
 * 2. gameKey
 * 3. population
 * 4. threshold
 * 5. matchCount
 */

const commandLineArguments = process.argv.slice(2);

const question =
  commandLineArguments[0] ||
  "DCCS 規則切換後持續使用舊規則可能代表什麼？";

const gameKey = normalizeFilter(
  commandLineArguments[1] || "DCCS"
);

const population = normalizeFilter(
  commandLineArguments[2] || "all"
);

const matchThreshold = clamp(
  parseNumber(
    commandLineArguments[3],
    parseNumber(RAG_MATCH_THRESHOLD, 0.5)
  ),
  0,
  1
);

const matchCount = Math.floor(
  clamp(
    parseNumber(
      commandLineArguments[4],
      parseNumber(RAG_MATCH_COUNT, 8)
    ),
    1,
    20
  )
);

/* =========================================================
 * 7. 執行 Supabase RAG 搜尋
 * ======================================================= */

async function searchClinicalKnowledge({
  query,
  filterGameKey = null,
  filterPopulation = null,
  threshold = 0.5,
  count = 8,
}) {
  const queryEmbedding =
    await createQueryEmbedding(query);

  console.log(
    `查詢向量維度：${queryEmbedding.length}`
  );

  const { data, error } = await supabase.rpc(
    "match_clinical_knowledge",
    {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: count,
      filter_game_key: filterGameKey,
      filter_population: filterPopulation,
    }
  );

  if (error) {
    const errorDetails = [
      "Supabase RAG 搜尋失敗。",
      `訊息：${error.message}`,
      error.details
        ? `詳細資訊：${error.details}`
        : null,
      error.hint
        ? `建議：${error.hint}`
        : null,
      error.code
        ? `錯誤代碼：${error.code}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    throw new Error(errorDetails);
  }

  return Array.isArray(data) ? data : [];
}

/* =========================================================
 * 8. 搜尋結果整理
 * ======================================================= */

function normalizeContent(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(text, maximumLength = 700) {
  const normalizedText = normalizeContent(text);

  if (normalizedText.length <= maximumLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(
    0,
    maximumLength
  )}...`;
}

function formatSimilarity(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "未知";
  }

  return `${(numericValue * 100).toFixed(2)}%`;
}

function displaySearchResults(results) {
  console.log(
    "\n========================================"
  );
  console.log("RAG 搜尋結果");
  console.log(
    "========================================"
  );

  if (results.length === 0) {
    console.log("沒有找到符合條件的段落。");
    console.log(
      "可以嘗試降低門檻，例如使用 0.4 或取消遊戲篩選。"
    );
    return;
  }

  results.forEach((result, index) => {
    console.log(
      `\n---------------- 結果 ${
        index + 1
      } ----------------`
    );

    console.log(
      `相似度：${formatSimilarity(
        result.similarity
      )}`
    );

    console.log(
      `標題：${result.title || "未命名文件"}`
    );

    if (result.authors) {
      console.log(`作者：${result.authors}`);
    }

    if (result.publication_year) {
      console.log(
        `年份：${result.publication_year}`
      );
    }

    if (result.journal) {
      console.log(`期刊：${result.journal}`);
    }

    console.log(
      `檔案：${result.file_name || "未知"}`
    );

    console.log(
      `遊戲：${result.game_key || "未分類"}`
    );

    console.log(
      `能力：${result.ability || "未分類"}`
    );

    console.log(
      `族群：${result.population || "未分類"}`
    );

    if (result.page_number) {
      console.log(
        `頁碼：${result.page_number}`
      );
    }

    if (result.section_title) {
      console.log(
        `章節：${result.section_title}`
      );
    }

    console.log(
      `段落內容：\n${truncateText(
        result.content
      )}`
    );
  });
}

/* =========================================================
 * 9. 搜尋品質摘要
 * ======================================================= */

function displayQualitySummary(results) {
  if (results.length === 0) {
    return;
  }

  const similarities = results
    .map((result) => Number(result.similarity))
    .filter(Number.isFinite);

  const uniqueDocumentIds = new Set(
    results
      .map((result) => result.document_id)
      .filter(Boolean)
  );

  const uniqueFileNames = new Set(
    results
      .map((result) => result.file_name)
      .filter(Boolean)
  );

  console.log(
    "\n========================================"
  );
  console.log("搜尋品質摘要");
  console.log(
    "========================================"
  );

  console.log(`結果數量：${results.length}`);
  console.log(
    `涉及文件：${Math.max(
      uniqueDocumentIds.size,
      uniqueFileNames.size
    )} 篇`
  );

  if (similarities.length > 0) {
    const highestSimilarity =
      Math.max(...similarities);

    const lowestSimilarity =
      Math.min(...similarities);

    const averageSimilarity =
      similarities.reduce(
        (total, value) => total + value,
        0
      ) / similarities.length;

    console.log(
      `最高相似度：${formatSimilarity(
        highestSimilarity
      )}`
    );

    console.log(
      `平均相似度：${formatSimilarity(
        averageSimilarity
      )}`
    );

    console.log(
      `最低相似度：${formatSimilarity(
        lowestSimilarity
      )}`
    );

    if (highestSimilarity < 0.5) {
      console.log(
        "提醒：最高相似度偏低，建議降低限制或檢查分類與切段品質。"
      );
    }
  }

  if (
    uniqueDocumentIds.size <= 1 &&
    uniqueFileNames.size <= 1 &&
    results.length >= 4
  ) {
    console.log(
      "提醒：結果集中在同一篇論文，之後可加入每篇文件最多回傳 1～2 段的限制。"
    );
  }
}

/* =========================================================
 * 10. 顯示本次查詢設定
 * ======================================================= */

function displaySearchConfiguration() {
  console.log(
    "========================================"
  );
  console.log("RAG 語意搜尋測試");
  console.log(
    "========================================"
  );

  console.log(`問題：${question}`);

  console.log(
    `遊戲篩選：${gameKey || "不限制"}`
  );

  console.log(
    `族群篩選：${population || "不限制"}`
  );

  console.log(
    `相似度門檻：${matchThreshold}`
  );

  console.log(
    `回傳數量：${matchCount}`
  );
}

/* =========================================================
 * 11. 主程式
 * ======================================================= */

async function main() {
  displaySearchConfiguration();

  const results =
    await searchClinicalKnowledge({
      query: question,
      filterGameKey: gameKey,
      filterPopulation: population,
      threshold: matchThreshold,
      count: matchCount,
    });

  displaySearchResults(results);
  displayQualitySummary(results);
}

main().catch((error) => {
  console.error(
    "\n========================================"
  );
  console.error("RAG 搜尋測試失敗");
  console.error(
    "========================================"
  );

  console.error(
    `錯誤名稱：${
      error?.name || "UnknownError"
    }`
  );

  console.error(
    `錯誤訊息：${
      error?.message || error
    }`
  );

  if (error?.stack) {
    console.error(error.stack);
  }

  process.exitCode = 1;
});